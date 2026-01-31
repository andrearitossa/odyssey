import {
  AIModality,
  TextToTextRequest,
  TextToTextResponse,
  SupportsTextToText,
  SupportsSpeechToText,
  SupportsTextToSpeech,
  AIProviderError,
} from '../interfaces';

export interface CloudflareAIConfig {
  apiToken: string;
  accountId: string;
  baseUrl?: string;
  model?: string;
}

export class CloudflareAIProvider implements SupportsTextToText, SupportsSpeechToText, SupportsTextToSpeech {
  readonly name = 'cloudflare';
  readonly supportedModalities = [AIModality.TextToText, AIModality.SpeechToText, AIModality.TextToSpeech];

  private config: CloudflareAIConfig;
  private baseUrl: string;

  constructor(config: CloudflareAIConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai/run`;
    this.config.model ||= '@cf/openai/gpt-oss-120b';
  }

  /**
   * Generates text using Cloudflare Workers AI.
   * Model defaults to: @cf/openai/gpt-oss-120b
   */
  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    const url = `${this.baseUrl}/${this.config.model}`;

    // OpenAI-compatible chat shape is widely supported.
    // Keep the payload minimal and tolerate provider-side differences.
    const requestBody: any = {
      messages: request.messages.map(({ role, content }) => ({ role, content })),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
      ...(request.stopSequences?.length ? { stop: request.stopSequences } : {})
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(`Cloudflare text generation API error: ${errorText}`, this.name, { status: response.status });
      }

      const data: any = await response.json();
      const { content, usage } = this.extractTextAndUsage(data);

      if (!content) {
        throw new AIProviderError('Empty text generation response from Cloudflare', this.name, data);
      }

      return { content, usage };
    } catch (err) {
      console.error('[CloudflareAIProvider] Text generation error:', err);
      throw err instanceof AIProviderError
        ? err
        : new AIProviderError('Text generation failed', this.name, err);
    }
  }

  private extractTextAndUsage(data: any): { content: string; usage?: TextToTextResponse['usage'] } {
    // Common Workers AI shapes (vary per model):
    // - { result: { response: string } }
    // - { result: { text: string } }
    // - OpenAI-like: { result: { choices: [{ message: { content } }] }, usage }
    const content =
      (typeof data?.result?.response === 'string' ? data.result.response : undefined) ??
      (typeof data?.result?.text === 'string' ? data.result.text : undefined) ??
      (typeof data?.result?.output_text === 'string' ? data.result.output_text : undefined) ??
      (typeof data?.result?.choices?.[0]?.message?.content === 'string' ? data.result.choices[0].message.content : undefined) ??
      (typeof data?.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content : undefined) ??
      '';

    const usageRaw = data?.result?.usage ?? data?.usage;
    const usage = usageRaw
      ? {
          promptTokens: usageRaw.prompt_tokens ?? usageRaw.promptTokens ?? 0,
          completionTokens: usageRaw.completion_tokens ?? usageRaw.completionTokens ?? 0,
          totalTokens: usageRaw.total_tokens ?? usageRaw.totalTokens ?? 0,
        }
      : undefined;

    return { content: content.trim(), usage };
  }

  /**
   * Transcribes audio using the Cloudflare Whisper API.
   * The API expects the raw audio file in the body, not JSON.
   */
  async transcribeAudio(audio: Blob | ArrayBuffer): Promise<{ text: string }> {
    // Note: Using the base 'whisper' model for broad compatibility.
    const url = `${this.baseUrl}/@cf/openai/whisper-large-v3-turbo`;
    try {
      // Convert audio to base64 string
      let base64Audio: string;
      let uint8Array: Uint8Array;
      if (audio instanceof Blob) {
        uint8Array = new Uint8Array(await audio.arrayBuffer());
      } else if (audio instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(audio);
      } else {
        throw new AIProviderError('Unsupported audio type for transcription', this.name);
      }
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      base64Audio = btoa(binary);

      // Prepare request body
      const requestBody: any = {
        audio: base64Audio,
        task: 'transcribe',
        language: 'en',
        // You can add language, vad_filter, initial_prompt, prefix if needed
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(`Cloudflare Whisper API error: ${errorText}`, this.name, { status: response.status });
      }

      const data = await response.json() as { result?: { text?: string } };
      if (!data.result || !data.result.text) {
        throw new AIProviderError('Invalid or empty transcription response from Cloudflare', this.name, data);
      }
      return { text: data.result.text };
    } catch (err) {
      console.error('[CloudflareAIProvider] Transcription error:', err);
      throw err instanceof AIProviderError
        ? err
        : new AIProviderError('Speech transcription failed', this.name, err);
    }
  }

  /**
   * Synthesizes speech using a Cloudflare TTS model.
   * The API expects JSON input and returns a raw audio file.
   */
  async synthesizeSpeech(text: string): Promise<Blob> {
    // Cloudflare TTS model: https://developers.cloudflare.com/workers-ai/models/aura-1/ 
    const url = `${this.baseUrl}/@cf/deepgram/aura-1`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text
        }),
      });

      // Check for error response
      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(`Cloudflare TTS API error: ${errorText}`, this.name, { status: response.status });
      }

      // Handle JSON (base64-encoded audio) or raw audio
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json() as { result?: { audio?: string } };
        if (!data.result || !data.result.audio) {
          throw new AIProviderError('Cloudflare TTS API returned JSON without audio field', this.name, data);
        }
        const base64Audio = data.result.audio;
        const binaryString = atob(base64Audio);
        const byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          byteArray[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([byteArray], { type: 'audio/wav' });
        if (audioBlob.size === 0) {
          throw new AIProviderError('Received empty audio blob from Cloudflare TTS API (base64)', this.name);
        }
        return audioBlob;
      }
      // Otherwise, return raw audio blob
      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        throw new AIProviderError('Received empty audio blob from Cloudflare TTS API', this.name);
      }
      return audioBlob;
    } catch (err) {
      console.error('[CloudflareAIProvider] Text-to-speech error:', err);
      throw err instanceof AIProviderError
        ? err
        : new AIProviderError('Text-to-speech synthesis failed', this.name, err);
    }
  }
}