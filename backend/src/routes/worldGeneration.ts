import { createJsonResponse, createErrorResponse } from '../utils/response';
import { handleServerError } from '../utils/errorHandling';
import { User } from '../database/db-types';
import { AIServiceManager, GeminiProvider, CloudflareAIProvider } from '../ai';

import { AIModality, AIProviderType, TextToTextRequest } from '../ai/interfaces';
import { Env } from '../routes';

import { Logger } from '../utils/logger';
import { WorldDbService } from '../database';

export class WorldGenerationRouter {
  private aiService: AIServiceManager;
  private worldDb: WorldDbService;

  constructor(env: Env) {
    this.worldDb = new WorldDbService(env.DB);
    this.aiService = new AIServiceManager();

    // Register providers
    if (env.GEMINI_API_KEY && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
      this.aiService.registerProvider(
        new GeminiProvider({ apiKey: env.GEMINI_API_KEY })
      );
      this.aiService.registerProvider(
        new CloudflareAIProvider({
          apiToken: env.CLOUDFLARE_API_TOKEN,
          accountId: env.CLOUDFLARE_ACCOUNT_ID
        })
      );
    } else {
      throw new Error('AI provider not configured properly: maybe GEMINI, maybe cloudflare AI');
    }

    // Set default providers for each modality
    this.aiService.setDefaultProviderForModality(AIModality.TextToText, AIProviderType.Cloudflare);
    this.aiService.setDefaultProviderForModality(AIModality.SpeechToText, AIProviderType.Cloudflare);
    this.aiService.setDefaultProviderForModality(AIModality.TextToSpeech, AIProviderType.Cloudflare);
  }

  async route(request: Request, user: User, ctx: ExecutionContext): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    // World generation routes
    const interactMatch = pathname.match(/^\/world-generation\/([^\/]+)\/interact$/);
    if (interactMatch && method === 'POST') {
      const worldId = interactMatch[1];
      return await this.interact(request, user, ctx, worldId);
    }

    return null; // Route not handled by this router
  }

  private async interact(request: Request, user: User, ctx: ExecutionContext, worldId: string): Promise<Response> {
    try {
      const audioData = await request.arrayBuffer();
      
      if (!audioData || audioData.byteLength === 0) {
        return createErrorResponse('No audio data provided', 400);
      }

      Logger.info('Step 1: Speech to Text');
      // The parameter is now correctly just the ArrayBuffer
      const transcription = await this.aiService.transcribeAudio(audioData);
      if (!transcription || !transcription.text) {
        return createErrorResponse('Failed to transcribe audio', 500);
      }
      Logger.info('Step 1 [closed]: Text:' + transcription.text);

      Logger.info('Step 2: Text Generation and Document Update');

      // Load current document state and include it in the prompt so the LLM can edit/append appropriately
      const existingWorld = await this.worldDb.getWorldByIdForUser(worldId, user.id);
      if (!existingWorld) {
        return createErrorResponse('World not found', 404, 'Not Found');
      }
      const currentDescription = existingWorld?.description || '';
      Logger.info("\n\n\n\nWORLD DESCRIPTION: "+currentDescription+"\n\n\n\n");

      // We expect the model to return a JSON object with two fields:
      // { "speech_text": "...text to synthesize...", "document_update": "...text to merge into world description..." }
      const textRequest: TextToTextRequest = {
        messages: [
          { role: 'system', content: worldGeneratorSystemPrompt },
          { role: 'user',
            content: `User input:\n${transcription.text}
\n\nCurrent document state:\n${currentDescription}` }
        ],
        temperature: 0.3,
        maxTokens: 5000
      };

      const textResponse = await this.aiService.generateText(textRequest);
      if (!textResponse.content) {
        return createErrorResponse('Failed to generate text response', 500);
      }

      let parsed: { speech_text: string; document_update: string };
      try {
        let content = textResponse.content.trim();
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (codeBlockMatch) {
          content = codeBlockMatch[1].trim();
        }
        parsed = JSON.parse(content) as { speech_text: string; document_update: string };
      } catch (err) {
        // If not JSON, fall back to using entire response as speech and document update
        return handleServerError("LLM did not gave back correct JSON. \n\nModel Genrated text: "+textResponse.content, 'LLM interaction', {  
          component: 'WorldGenerationRouter',  
          operation: 'INTERACT',
          userId: user.id  
        });
      }

      Logger.info('Step 2 [closed]: Speech text:' + parsed.speech_text);
      Logger.info('Step 2 [closed]: Document update length:' + (parsed.document_update || '').length);

      Logger.info('Step 3: Speech Synthesis');
      const audioBlob = await this.aiService.synthesizeSpeech(parsed.speech_text);
      Logger.info('Step 3 [closed]: Audio generated' + audioBlob.size + ' bytes');

      // Persist document update to DB: store as full description replacement for simplicity
      try {
        const updatedWorld = await this.worldDb.updateWorldDescriptionForUser(worldId, user.id, parsed.document_update || null);
        if (!updatedWorld) {
          return createErrorResponse('World not found', 404, 'Not Found');
        }
        // Return JSON containing base64 audio and updated document
        const base64Audio = await (async () => {
          const arrayBuffer = await audioBlob.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(arrayBuffer);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return btoa(binary);
        })();

        return createJsonResponse({
          success: true,
          audio_base64: base64Audio,
          audio_content_type: 'audio/wav',
          document: updatedWorld ? updatedWorld.description : parsed.document_update
        });
      } catch (err) {
        Logger.error('Failed to persist world document update', err);
        // Still return audio and document_update even if persistence fails
        const arrayBuffer = await audioBlob.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64Audio = btoa(binary);
        return createJsonResponse({
          success: true,
          audio_base64: base64Audio,
          audio_content_type: 'audio/wav',
          document: parsed.document_update
        });
      }
    } catch (error) {
      Logger.error('Error in audio interaction:', error);
      return handleServerError(error, 'process audio interaction', {  
        component: 'WorldGenerationRouter',  
        operation: 'INTERACT',
        userId: user.id  
      });
    }
  }
}

const worldGeneratorSystemPrompt = `You are a helpful assistant.

Your task is to respond to the user request.
Assist him into creating a world, maintaining the document; representing the world.
- Preserve the world-document existing
- Organizing the user's idea into a clear, readable document.
- Refactor it conservately following closely user requests.
- Refactor it only when the user intent has been specified. Dont assume it.

The world document is treated as Markdown (CommonMark). The "document_update" you output MUST be a valid Markdown document:
- Preserve existing Markdown structure and formatting where possible (headings, lists, emphasis).
- Prefer simple Markdown (headings, bullet lists, short paragraphs).
- Do NOT wrap the entire document in triple backticks.

When you reply, return a single valid JSON object and nothing else with the following keys:
1. "speech_text":
  a short (one or two sentences) utterance for the user, for text-to-speech synthesis.
  Keep it concise (<= 30 words).
2. "document_update":
  the full, updated world description text (Markdown) that will replace the current document in the database.

Do not include ANY explanatory text or additional fields outside that JSON object.`;
