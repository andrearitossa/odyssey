import {
  AIModality,
  AIProviderType,
  TextToTextRequest,
  TextToTextResponse,
  AIProvider,
  SupportsTextToText,
  SupportsSpeechToText,
  SupportsTextToSpeech,
  UnsupportedModalityError,
  AIProviderError
} from './interfaces';

export class AIServiceManager {
  private providers = new Map<string, AIProvider>();
  private defaultProviders = new Map<AIModality, string>();

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefaultProviderForModality(modality: AIModality, name: AIProviderType): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} is not registered`);
    }
    this.defaultProviders.set(modality, name);
  }

  private getProvider(modality: AIModality, name?: string): AIProvider {
    const providerName = name ?? this.defaultProviders.get(modality);
    if (!providerName) {
      throw new Error(`No default provider configured for modality ${modality}`);
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} is not registered or found`);
    }

    return provider;
  }

  async generateText(request: TextToTextRequest, providerName?: string): Promise<TextToTextResponse> {
    const provider = this.getProvider(AIModality.TextToText, providerName);

    if (!provider.supportedModalities.includes(AIModality.TextToText)) {
      throw new UnsupportedModalityError(AIModality.TextToText, provider.name);
    }

    try {
      return await (provider as SupportsTextToText).generateText(request);
    } catch (error) {
      throw new AIProviderError('Text generation failed', provider.name, error);
    }
  }
  
  async transcribeAudio(audioData: ArrayBuffer, providerName?: string): Promise<{ text: string }> {
    const provider = this.getProvider(AIModality.SpeechToText, providerName);

    if (!provider.supportedModalities.includes(AIModality.SpeechToText)) {
      throw new UnsupportedModalityError(AIModality.SpeechToText, provider.name);
    }

    try {
      return await (provider as SupportsSpeechToText).transcribeAudio(audioData);
    } catch (error) {
      throw new AIProviderError('Speech transcription failed', provider.name, error);
    }
  }

  async synthesizeSpeech(text: string, providerName?: string): Promise<Blob> {
    const provider = this.getProvider(AIModality.TextToSpeech, providerName);

    if (!provider.supportedModalities.includes(AIModality.TextToSpeech)) {
      throw new UnsupportedModalityError(AIModality.TextToSpeech, provider.name);
    }

    try {
      return await (provider as SupportsTextToSpeech).synthesizeSpeech(text);
    } catch (error) {
      throw new AIProviderError('Text-to-speech synthesis failed', provider.name, error);
    }
  }

  listProviders(): Array<{ name: string; supportedModalities: AIModality[] }> {
    return [...this.providers.values()].map(({ name, supportedModalities }) => ({
      name,
      supportedModalities,
    }));
  }
}