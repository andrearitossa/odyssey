export interface LogContext {
  sessionId?: string;
  userId?: number;
  operation?: string;
  component?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private static samplingRate: number = 1.0;
  private static logRequestDetails: boolean = true;

  /**
   * Initialize logger with environment variables
   * Call this once at worker startup
   */
  static initialize(env?: any): void {
    if (env?.LOG_LEVEL) {
      switch (env.LOG_LEVEL.toUpperCase()) {
        case 'DEBUG':
          this.logLevel = LogLevel.DEBUG;
          break;
        case 'INFO':
          this.logLevel = LogLevel.INFO;
          break;
        case 'WARN':
          this.logLevel = LogLevel.WARN;
          break;
        case 'ERROR':
          this.logLevel = LogLevel.ERROR;
          break;
      }
    }

    if (env?.LOG_SAMPLING_RATE) {
      this.samplingRate = parseFloat(env.LOG_SAMPLING_RATE) || 1.0;
    }

    if (env?.LOG_REQUEST_DETAILS !== undefined) {
      this.logRequestDetails = env.LOG_REQUEST_DETAILS === 'true';
    }

    // Log initialization to verify it's working
    console.log(`[LOGGER_INIT] Level: ${LogLevel[this.logLevel]}, Sampling: ${this.samplingRate}, RequestDetails: ${this.logRequestDetails}`);
  }

  private static shouldLog(level: LogLevel): boolean {
    if (level < this.logLevel) return false;
    if (this.samplingRate < 1.0 && Math.random() > this.samplingRate) return false;
    return true;
  }

  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  private static formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp();
    const sessionId = context?.sessionId ? `[${context.sessionId.substring(0, 8)}...]` : '';
    const component = context?.component ? `[${context.component}]` : '';
    const operation = context?.operation ? `[${context.operation}]` : '';
    const duration = context?.duration ? `(${context.duration}ms)` : '';
    
    let logLine = `${timestamp} ${level} ${component}${operation}${sessionId} ${message} ${duration}`;
    
    if (context?.metadata && Object.keys(context.metadata).length > 0) {
      logLine += ` | ${JSON.stringify(context.metadata)}`;
    }
    
    return logLine.trim();
  }

  /**
   * Structured logging for Cloudflare Workers
   * This ensures logs appear in wrangler tail and dashboard
   */
  private static structuredLog(level: string, message: string, context?: LogContext): object {
    const logData = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      component: context?.component,
      operation: context?.operation,
      sessionId: context?.sessionId?.substring(0, 8),
      userId: context?.userId,
      duration: context?.duration,
      metadata: context?.metadata
    };

    // Remove undefined fields for cleaner logs
    Object.keys(logData).forEach(key => {
      if (logData[key as keyof typeof logData] === undefined) {
        delete logData[key as keyof typeof logData];
      }
    });

    return logData;
  }

  static info(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    // If the second argument is a LogContext, preserve old behavior
    let context: LogContext | undefined = undefined;
    if (args.length === 1 && typeof args[0] === 'object' && !(args[0] instanceof Array)) {
      context = args[0];
    }
    const formatted = this.formatMessage('INFO', message, context);
    const structured = this.structuredLog('INFO', message, context);
    console.log(formatted);
    if (context) {
      console.log('[STRUCTURED]', JSON.stringify(structured));
    }
    // If there are additional args, log them as JSON for inspection
    if (args.length > 0) {
      args.forEach((arg) => {
        if (arg && typeof arg === 'object') {
          console.log('[INFO_OBJECT]', JSON.stringify(arg, null, 2));
        }
      });
    }
  }

  static warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const formatted = this.formatMessage('WARN', message, context);
    const structured = this.structuredLog('WARN', message, context);
    
    // Use console.warn for WARN level - this appears prominently in wrangler logs
    console.warn(formatted);
    console.warn('[STRUCTURED]', JSON.stringify(structured));
  }

  static error(message: string, error?: any, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const errorDetails = error ? ` - ${error.message || error}` : '';
    const formatted = this.formatMessage('ERROR', message + errorDetails, context);
    const structured = this.structuredLog('ERROR', message + errorDetails, context);
    
    // Use console.error for ERROR level - this appears prominently in wrangler logs
    console.error(formatted);
    console.error('[STRUCTURED]', JSON.stringify(structured));
    
    if (error?.stack) {
      console.error('[STACK]', error.stack);
    }
  }

  static debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const formatted = this.formatMessage('DEBUG', message, context);
    const structured = this.structuredLog('DEBUG', message, context);
    
    // Use console.log for DEBUG level
    console.log(formatted);
    console.log('[STRUCTURED]', JSON.stringify(structured));
  }

  static timing(operation: string, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;
    this.info(`${operation} completed`, { ...context, duration });
  }

  /**
   * Request logging specifically designed for Cloudflare Workers
   */
  static logRequest(request: Request, response?: Response, context?: LogContext): void {
    if (!this.logRequestDetails) return;

    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Skip logging for health checks and very frequent requests in production
    const skipLogging = [
      '/health',
      '/auth/validate'
    ];
    
    if (this.logLevel > LogLevel.DEBUG && skipLogging.some(path => pathname === path)) {
      return;
    }
    
    const requestData = {
      method: request.method,
      url: pathname,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.headers.get('CF-IPCountry'),
      ray: request.headers.get('CF-Ray'),
      status: response?.status,
      contentType: response?.headers.get('Content-Type')
    };

    this.info(`${request.method} ${pathname}`, {
      ...context,
      component: 'REQUEST',
      metadata: requestData
    });
  }

  /**
   * Performance logging for monitoring
   */
  static performance(metric: string, value: number, unit: string = 'ms', context?: LogContext): void {
    this.info(`PERF: ${metric} = ${value}${unit}`, {
      ...context,
      component: 'PERFORMANCE',
      metadata: { metric, value, unit }
    });
  }

  /**
   * Get current log level for external checks
   */
  static getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Check if request details logging is enabled
   */
  static isRequestLoggingEnabled(): boolean {
    return this.logRequestDetails;
  }
}
