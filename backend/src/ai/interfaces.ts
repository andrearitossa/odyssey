export interface TextToTextRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
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

export enum AIModality {
  TextToText = 'text-to-text',
  SpeechToText = 'speech-to-text',
  TextToSpeech = 'text-to-speech',
  SpeechToSpeech = 'speech-to-speech',
}

export enum AIProviderType {
  Gemini = 'gemini',
  Cloudflare = 'cloudflare',
  HuggingFace = 'huggingface',
}

// Base provider interface
export interface AIProvider {
  readonly name: string;
  readonly supportedModalities: AIModality[];
}

// Per-modality interfaces
export interface SupportsTextToText extends AIProvider {
  generateText(request: TextToTextRequest): Promise<TextToTextResponse>;
}

export interface SupportsSpeechToText extends AIProvider {
  transcribeAudio(audio: Blob | ArrayBuffer): Promise<{ text: string }>;
}

export interface SupportsTextToSpeech extends AIProvider {
  synthesizeSpeech(text: string): Promise<Blob>;
}

export interface SupportsSpeechToSpeech extends AIProvider {
  translateSpeech(audio: Blob): Promise<Blob>;
}

// Error classes
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