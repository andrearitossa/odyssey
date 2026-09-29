import {
  AIProvider,
  TextToTextRequest,
  TextToTextResponse,
} from './interfaces';

export class AIServiceManager {
  private provider: AIProvider | null = null;

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    if (!this.provider) {
      throw new Error('No AI provider configured');
    }
    return await this.provider.generateText(request);
  }

  hasProvider(): boolean {
    return this.provider !== null;
  }

  canStream(): boolean {
    return Boolean(this.provider?.streamingSupported && this.provider.streamText);
  }

  streamText(request: TextToTextRequest): Promise<ReadableStream<Uint8Array>> {
    if (!this.provider?.streamText) throw new Error('Streaming is unavailable');
    return this.provider.streamText(request);
  }

  getProviderName(): string {
    return this.provider?.name || 'none';
  }
}
