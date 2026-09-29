const OPEN = '<session_memory>';
const CLOSE = '</session_memory>';

/** The optional private footer never determines whether valid story text can be used. */
export function parseStoryReply(raw: string): { response: string; memory?: string } {
  const start = raw.indexOf(OPEN);
  if (start < 0) return { response: visibleStoryPrefix(raw).trim() };
  const end = raw.indexOf(CLOSE, start + OPEN.length);
  const memory = end < 0 ? '' : raw.slice(start + OPEN.length, end).trim();
  return { response: raw.slice(0, start).trim(), ...(memory && memory.length <= 6000 ? { memory } : {}) };
}

/** Withhold even a partially streamed opening marker, so private memory cannot flash onscreen. */
export function visibleStoryPrefix(raw: string): string {
  const start = raw.indexOf(OPEN);
  if (start >= 0) return raw.slice(0, start);
  for (let length = OPEN.length - 1; length > 0; length--) {
    if (raw.endsWith(OPEN.slice(0, length))) return raw.slice(0, -length);
  }
  return raw;
}

// Read previously saved structured transcripts; new turns use ordinary numbered text.
type StoredTurn = { format: 'story-v1'; scene: string; choices: Array<{label: string; riskCue: string}> };
export function readStoredTurn(content: string): StoredTurn | null {
  try {
    const value = JSON.parse(content);
    return value?.format === 'story-v1' && typeof value.scene === 'string' && Array.isArray(value.choices) ? value as StoredTurn : null;
  } catch { return null; }
}
export function renderTurn(turn: StoredTurn): string {
  return turn.scene + '\n\n' + turn.choices.map((c, i) => `${i + 1}. ${c.label} — ${c.riskCue}`).join('\n');
}
