import { createJsonResponse, createErrorResponse, parseJsonBody, corsHeaders } from '../utils/response';
import { validateRequiredFields, generateSessionId, isValidWorldId, isValidSessionId } from '../utils/validation';
import { Logger } from '../utils/logger';
import { sanitizeInput } from '../utils/sanitization';

import { InteractWithStoryRequest } from './api-types';
import { Env } from '../routes';
import { StoryService } from '../story/storyService';
import { AIServiceManager, GeminiProvider, HuggingFaceProvider } from '../ai';
import { WorldDbService, SessionDbService, StoryModelDbService, ChapterDbService, MessageDbService } from '../database';
import { Chapter } from '../database/db-types';
import { User } from '../database/db-types';
import { AIModality, AIProviderType } from '../ai';

export class StoryInteractionRouter {
    private worldDB: WorldDbService;
    private sessionDB: SessionDbService;
    private storyModelDB: StoryModelDbService;
    private chapterDB: ChapterDbService;
    private messageDB: MessageDbService;
    private aiService: AIServiceManager;
    private storyService: StoryService;

    constructor(env: Env) {
        const timer = Date.now();
        const context = {
            component: 'StoryInteractionRouter',
            operation: 'INIT'
        };

        Logger.info('Initializing StoryInteractionRouter', context);

        // Instantiate other DB services using env.DB
        this.worldDB = new WorldDbService(env.DB);
        this.sessionDB = new SessionDbService(env.DB);
        this.storyModelDB = new StoryModelDbService(env.DB);
        this.chapterDB = new ChapterDbService(env.DB);
        this.messageDB = new MessageDbService(env.DB);

        this.aiService = new AIServiceManager();
        if (env.GEMINI_API_KEY) {
            const geminiProvider = new GeminiProvider({ apiKey: env.GEMINI_API_KEY });
            this.aiService.registerProvider(geminiProvider);

            this.aiService.setDefaultProviderForModality(AIModality.TextToText, AIProviderType.Gemini);
            Logger.info('AI provider configured', { ...context, metadata: { provider: 'Gemini' } });
        }
        // else if (env.HUGGINGFACE_API_KEY?.startsWith('hf_')) {
        //     const hfProvider = new HuggingFaceProvider({ apiKey: env.HUGGINGFACE_API_KEY, model: 'mistralai/Mistral-7B-Instruct-v0.3' });
        //     this.aiService.registerProvider(hfProvider);
        //     this.aiService.setDefaultProviderForModality(AIModality.TextToText, AIProviderType.HuggingFace);
        //     Logger.info('AI provider configured', { ...context, metadata: { provider: 'HuggingFace', model: 'mistralai/Mistral-7B-Instruct-v0.3' } });
        // } 
        else {
            Logger.warn('No AI provider configured', context);
        }

        this.storyService = new StoryService(this.aiService);

        Logger.info('StoryInteractionRouter initialized successfully', { ...context, duration: Date.now() - timer });
    }

    async route(request: Request, user: User, ctx?: ExecutionContext): Promise<Response | null> {
        const timer = Date.now();
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        const context = {
            component: 'StoryInteractionRouter',
            operation: 'ROUTE',
            metadata: { method, pathname }
        };

        Logger.debug('Processing route request', context);

        if (pathname === '/sessions/new' && method === 'POST') {
            Logger.info('Routing to create session', { ...context, operation: 'ROUTE_TO_CREATE_SESSION', duration: Date.now() - timer });
            return this.createSession(request, user, ctx);
        }

        const chaptersMatch = pathname.match(/^\/sessions\/([^\/]+)\/chapters$/);
        if (chaptersMatch && method === 'GET') {
            const sessionId = chaptersMatch[1];
            Logger.info('Routing to get chapters', { ...context, sessionId, operation: 'ROUTE_TO_GET_CHAPTERS', duration: Date.now() - timer });
            return this.getChapters(request, user, sessionId);
        }

        const sessionInteractMatch = pathname.match(/^\/sessions\/([^\/]+)\/interact$/);
        if (sessionInteractMatch && method === 'POST') {
            const sessionId = sessionInteractMatch[1];
            Logger.info('Routing to story interaction', { ...context, sessionId, operation: 'ROUTE_TO_INTERACT', duration: Date.now() - timer });
            return await this.interactWithStory(request, user, sessionId, ctx);
        }

        Logger.debug('Route not handled by StoryInteractionRouter', { ...context, duration: Date.now() - timer });
        return null;
    }


    private async getChaptersStructured(sessionId: string): Promise<{ history: Chapter[], current: Chapter | null, future: Chapter[] }> {
        const [history, current, future] = await Promise.all([
            this.chapterDB.getChaptersByStatus(sessionId, 'history'),
            this.chapterDB.getCurrentChapter(sessionId),
            this.chapterDB.getChaptersByStatus(sessionId, 'future')
        ]);
        return { history, current, future };
    }

    private async getChapters(request: Request, user: User, sessionId: string): Promise<Response> {
        const context = {
            component: 'StoryInteractionRouter',
            operation: 'GET_CHAPTERS',
            sessionId
        };
        Logger.info('Fetching chapters', context);

        try {
            if (!isValidSessionId(sessionId)) {
                Logger.warn('Invalid session ID format', context);
                return createErrorResponse('Invalid session ID format', 400);
            }

            const session = await this.sessionDB.getSessionWithUser(sessionId, user.id);
            if (!session) {
                Logger.warn('Session not found or access denied', context);
                return createErrorResponse('Session not found or access denied', 404, 'Not Found');
            }

            const { history, current, future } = await this.getChaptersStructured(sessionId);

            Logger.info('Chapters fetched successfully', { ...context, userId: user.id });
            return createJsonResponse({ history, current, future });
        } catch (error) {
            Logger.error('Error fetching chapters', error, context);
            return createErrorResponse('Failed to fetch chapters', 500);
        }
    }

    private async createSession(request: Request, user: User, ctx?: ExecutionContext): Promise<Response> {
        const context = {
            component: 'StoryInteractionRouter',
            operation: 'CREATE_SESSION'
        };
        Logger.info('Creating new session', context);

        try {
            const body = await parseJsonBody<{ worldId: string }>(request);
            const validationError = validateRequiredFields(body, ['worldId']);
            if (validationError) {
                Logger.warn('Validation error for create session body', { ...context, metadata: { error: validationError } });
                return createErrorResponse(validationError, 400);
            }

            if (!isValidWorldId(body.worldId)) {
                Logger.warn('Invalid world ID format', context);
                return createErrorResponse('Invalid world ID format', 400);
            }

            const world = await this.worldDB.getWorldById(body.worldId);
            if (!world) {
                Logger.warn('World not found', context);
                return createErrorResponse('World not found', 404, 'Not Found');
            }

            const sessionId = generateSessionId();
            const session = await this.sessionDB.createSession(sessionId, user.id, world.id);
            Logger.info(`Session ${session.id} created`, { ...context, userId: user.id, metadata: { worldId: world.id } });

            // --- Synchronous Story Initialization ---
            try {
                const { storyModelData, chapters } = await this.storyService.initializeStory({ session, world, user });

                await this.storyModelDB.createStoryModel(
                    session.id,
                    storyModelData.core_theme_moral_message,
                    storyModelData.genre_style_voice,
                    storyModelData.setting,
                    storyModelData.protagonist,
                    storyModelData.conflict_sources,
                    storyModelData.intended_impact
                );

                await this.chapterDB.createChapter(session.id, 1, chapters.currentChapter.title, chapters.currentChapter.description, 'current');
                
                const chapterCreationPromises = chapters.futureChapters.map((chapter, i) => 
                    this.chapterDB.createChapter(session.id, 2 + i, chapter.title, chapter.description, 'future')
                );
                await Promise.all(chapterCreationPromises);
                
                Logger.info(`Synchronous initialization complete for session ${session.id}`, { ...context, sessionId: session.id });
            } catch (err) {
                Logger.error(`Synchronous session initialization failed for ${session.id}`, err, context);
                return createErrorResponse('Failed to initialize story content', 500);
            }

            return createJsonResponse({ sessionId: session.id, worldId: session.world_id, createdAt: session.created_at }, 201);
        } catch (error) {
            Logger.error('Error creating session', error, context);
            return createErrorResponse('Failed to create session', 500);
        }
    }

    private async interactWithStory(request: Request, user: User, sessionId: string, ctx?: ExecutionContext): Promise<Response> {
        const timer = Date.now();
        const context = {
            component: 'StoryInteractionRouter',
            operation: 'INTERACT_WITH_STORY',
            sessionId
        };

        Logger.info('Starting story interaction', context);

        try {
            if (!isValidSessionId(sessionId)) {
                Logger.warn('Invalid session ID format', context);
                return createErrorResponse('Invalid session ID format', 400);
            }

            const body = await parseJsonBody<InteractWithStoryRequest>(request);
            const validationError = validateRequiredFields(body, ['message']);
            if (validationError) {
                Logger.warn('Validation error for interact with story body', { ...context, metadata: { error: validationError } });
                return createErrorResponse(validationError, 400);
            }

            const userMessage = sanitizeInput(body.message);
            if (!userMessage) {
                Logger.warn('User message is empty', context);
                return createErrorResponse('Message cannot be empty', 400);
            }

            const session = await this.sessionDB.getSessionWithUser(sessionId, user.id);
            if (!session) {
                Logger.warn('Session not found or access denied', context);
                return createErrorResponse('Session not found or access denied', 404, 'Not Found');
            }

            const world = await this.worldDB.getWorldById(session.world_id);
            if (!world) {
                Logger.warn('World not found', context);
                return createErrorResponse('World not found', 404, 'Not Found');
            }

            // --- StoryService Orchestration ---
            const [storyModel, allChapters, recentMessages] = await Promise.all([
                this.storyModelDB.getStoryModelBySessionId(sessionId),
                this.getChaptersStructured(sessionId),
                this.messageDB.getRecentSessionMessages(sessionId, 10)
            ]);

            if (!storyModel) {
                Logger.error('Story model not found for this session', context);
                return createErrorResponse('Story model not found for this session', 404);
            }
            if (!allChapters.current) {
                Logger.error('No active chapter found for this session', context);
                return createErrorResponse('No active chapter found for this session', 404);
            }

            const { narratorResponse, storyOutput, shouldTransition } = await this.storyService.processUserInput(
                storyModel,
                allChapters,
                recentMessages,
                userMessage,
                user
            );

            const handleBackgroundOperations = async () => {
                try {
                    const currentChapterNumber = allChapters.current!.chapter_number;
                    await this.messageDB.createMessage(sessionId, 'user', userMessage, currentChapterNumber);
                    const narratorMessagePromise = this.messageDB.createMessage(sessionId, 'narrator', narratorResponse, currentChapterNumber);

                    if (storyOutput.modifications.currentChapterModified) {
                        await this.chapterDB.updateChapterTitleAndDescription(
                            allChapters.current!.id,
                            storyOutput.currentChapter.title,
                            storyOutput.currentChapter.description
                        );
                    }
                    if (storyOutput.modifications.futureChaptersModified || storyOutput.modifications.newChaptersAdded) {
                        await this.chapterDB.clearFutureChapters(sessionId);
                        for (let i = 0; i < storyOutput.futureChapters.length; i++) {
                            const chapter = storyOutput.futureChapters[i];
                            await this.chapterDB.createChapter(sessionId, allChapters.history.length + 2 + i, chapter.title, chapter.description, 'future');
                        }
                    }
                    if (shouldTransition) {
                        await narratorMessagePromise;
                        await this.chapterDB.completeCurrentChapter(sessionId);
                        await this.chapterDB.setNextChapterAsCurrent(sessionId);
                    }
                } catch (error) {
                    Logger.error('Background database operations failed', error, context);
                }
            };

            if (ctx) {
                ctx.waitUntil(handleBackgroundOperations());
            } else {
                handleBackgroundOperations();
            }

            Logger.info('Story interaction completed successfully', {
                ...context,
                userId: user.id,
                duration: Date.now() - timer
            });

            return new Response(JSON.stringify({ response: narratorResponse }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });

        } catch (error) {
            Logger.error('Story interaction failed', error, {
                ...context,
                duration: Date.now() - timer
            });
            return createErrorResponse('Failed to process story interaction', 500);
        }
    }
}
