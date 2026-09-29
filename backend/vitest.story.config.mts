import { defineConfig } from 'vitest/config';

// Real SQLite queries with a controlled AI provider; no remote services.
export default defineConfig({ test: { environment: 'node', include: ['tests/story.spec.ts'] } });
