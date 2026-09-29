import { AIModality, AIProvider, AIProviderError, TextToTextRequest, TextToTextResponse } from '../interfaces';

/** Cloudflare Workers AI text generation through the Worker binding. */
export class WorkersAiProvider implements AIProvider {
  readonly name = 'workers-ai';
  readonly supportedModalities = [AIModality.TextToText];

  constructor(private binding: Ai, private model = '@cf/zai-org/glm-5.3-flash') {}

  get streamingSupported(): boolean { return this.model.includes('glm-5.3-flash'); }

  async streamText(request: TextToTextRequest): Promise<ReadableStream<Uint8Array>> {
    if (!this.model.includes('glm-5.3-flash')) throw new AIProviderError('Streaming is unavailable for this model', this.name);
    const stream = await this.binding.run(this.model as keyof AiModels, {
      messages: request.messages,
      stream: true,
      reasoning_effort: 'low',
      max_completion_tokens: Math.min(request.maxTokens ?? 320, 320),
      temperature: request.temperature,
    } as never);
    return stream as ReadableStream<Uint8Array>;
  }

  async generateText(request: TextToTextRequest): Promise<TextToTextResponse> {
    try {
      const usesResponsesApi = this.model.includes('gpt-oss');
      const input = usesResponsesApi ? {
        input: request.messages.map(message => ({ role: message.role, content: message.content })),
        max_output_tokens: request.maxTokens,
        reasoning: { effort: 'low' },
      } : {
        messages: request.messages,
        temperature: request.temperature,
        max_completion_tokens: this.model.includes('glm-5.3-flash') ? Math.min(request.maxTokens ?? 320, 320) : request.maxTokens,
        reasoning_effort: 'low',
      };
      const result = await this.binding.run(this.model as keyof AiModels, input as never) as {
        response?: string;
        choices?: Array<{ message?: { content?: string } }>;
        output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      // Responses API models also include reasoning entries; only show final message text.
      const content = result?.response || result?.choices?.[0]?.message?.content || result?.output?.filter(item => item.type === 'message')
        .flatMap(item => item.content ?? [])
        .filter(item => item.type === 'output_text')
        .map(item => item.text ?? '').join('\n') || '';
      if (!content.trim()) throw new Error('The model returned an empty response');
      return {
        content: content.trim(),
        usage: result.usage ? {
          promptTokens: result.usage.prompt_tokens ?? 0,
          completionTokens: result.usage.completion_tokens ?? 0,
          totalTokens: result.usage.total_tokens ?? 0,
        } : undefined,
      };
    } catch (error) {
      throw new AIProviderError(error instanceof Error ? error.message : 'Story generation failed', this.name, error);
    }
  }
}
