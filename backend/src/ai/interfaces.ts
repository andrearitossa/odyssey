// === AI Provider INTERFACES ===

export interface TextToTextRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  structured?: boolean;
  stopSequences?: string[];
}

export interface TextToTextResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// === AI PROVIDER INTERFACES ===

export enum AIModality {
  TextToText = 'text-to-text'
}

export interface AIProvider {
  readonly name: string;
  readonly supportedModalities: AIModality[];
  generateText(request: TextToTextRequest): Promise<TextToTextResponse>;
  streamText?(request: TextToTextRequest): Promise<ReadableStream<Uint8Array>>;
  readonly streamingSupported?: boolean;
}

export interface AIService {
  registerProvider(provider: AIProvider): void;
  getProvider(name: string): AIProvider | undefined;
  setDefaultProvider(name: string): void;
  generateText(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse>;
  listProviders(): Array<{ name: string; supportedModalities: AIModality[] }>;
}

// === ERROR CLASSES ===

export class AIProviderError extends Error {
  constructor(message: string, public providerName: string, public originalError?: unknown) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class UnsupportedModalityError extends Error {
  constructor(public modality: AIModality, public providerName: string) {
    super(`Provider ${providerName} does not support modality: ${modality}`);
    this.name = 'UnsupportedModalityError';
  }
}
