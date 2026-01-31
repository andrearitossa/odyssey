import {
  AIModality,
  TextToTextRequest,
  TextToTextResponse,
  AIProviderError,
  UnsupportedModalityError,
  SupportsTextToText
} from '../interfaces';

export interface GeminiConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class GeminiProvider implements SupportsTextToText {
  readonly name = 'gemini';
  readonly supportedModalities = [AIModality.TextToText];

  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.config.baseUrl ||= 'https://generativelanguage.googleapis.com/v1beta';
    this.config.model ||= 'gemini-2.5-flash';
  }

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    const { systemInstruction, contents } = this.formatMessages(request.messages);

    const payload: any = {
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        ...(request.stopSequences && { stopSequences: request.stopSequences })
      },
      ...(systemInstruction && {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      })
    };

    const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new AIProviderError(
          `Gemini API error: ${await response.text()}`,
          this.name,
          response.status
        );
      }

      const data: any = await response.json();
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text?.trim();

      if (!content) {
        throw new AIProviderError('Empty response', this.name);
      }

      return {
        content,
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount ?? 0,
              completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: data.usageMetadata.totalTokenCount ?? 0
            }
          : undefined
      };
    } catch (err) {
      throw err instanceof AIProviderError
        ? err
        : new AIProviderError('Text generation failed', this.name, err);
    }
  }

  private formatMessages(messages: Array<{ role: string; content: string }>) {
    let systemInstruction: string | null = null;
    const contents: any[] = [];

    for (const { role, content } of messages) {
      if (role === 'system') {
        systemInstruction = content;
      } else {
        contents.push({
          role: role === 'assistant' ? 'model' : 'user',
          parts: [{ text: content }]
        });
      }
    }

    return { systemInstruction, contents };
  }
}