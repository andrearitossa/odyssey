import { expect, test } from 'vitest';
import { initialStoryState, validateStoryTurn } from '../src/story/state';
import { WorkersAiProvider } from '../src/ai/providers/workersAi';

const draft = (changes: unknown[] = [], refs: string[] = []) => ({
  scene: 'You take stock of your surroundings.', elapsedMinutes: 1, changes,
  choices: ['Look', 'Listen', 'Wait'].map(label => ({ label, action: label, riskCue: 'time passes', requires: refs })),
});
const apply = (state: ReturnType<typeof initialStoryState>, changes: unknown[] = [], refs: string[] = []) => validateStoryTurn(JSON.stringify(draft(changes, refs)), state);
const item = (id: string, at: string) => ({ id, kind: 'item' as const, name: id, at, condition: 'intact' as const });

test('compound movement applies in order, keeping the original state unchanged', () => {
  const state = initialStoryState('custom');
  state.entities.key = item('key', 'scene');
  state.entities.hall = { id: 'hall', kind: 'place', name: 'Hall', condition: 'intact' };
  const result = apply(state, [
    { op: 'move', id: 'key', from: 'scene', to: 'player' },
    { op: 'move', id: 'player', from: 'scene', to: 'hall' },
    { op: 'move', id: 'key', from: 'player', to: 'hall' },
  ]);
  expect(result.state.entities.key.at).toBe('hall');
  expect(state.entities.key.at).toBe('scene');
  expect(result.state.version).toBe(1);
});

test('invented coins, inaccessible scarf and absent person cannot be used', () => {
  const state = initialStoryState('titanic-adventure');
  state.entities.scarf = { ...item('scarf', 'below_deck'), condition: 'inaccessible' };
  for (const ref of ['coins', 'scarf', 'sibling']) {
    expect(() => apply(state, [], [ref])).toThrow();
    expect(() => apply(state, [{ op: 'move', id: ref, from: 'player', to: 'scene' }])).toThrow();
  }
});

test('introduced possessions require discovery at a place, not retroactive inventory', () => {
  const state = initialStoryState('custom');
  expect(() => apply(state, [{ op: 'introduce', id: 'watch', name: 'Watch', kind: 'item', at: 'player', reason: 'I always had it' }])).toThrow();
  const result = apply(state, [
    { op: 'introduce', id: 'rope', name: 'Rope', kind: 'item', at: 'scene', reason: 'Visible coiled beside the hatch' },
    { op: 'move', id: 'rope', from: 'scene', to: 'player' },
  ]);
  expect(result.state.entities.rope.at).toBe('player');
});

test('letter fragments remain recoverable but destroyed evidence cannot be restored', () => {
  const state = initialStoryState('the-kreutzer-sonata');
  const torn = apply(state, [{ op: 'condition', id: 'letter', condition: 'torn' }, { op: 'move', id: 'letter', from: 'player', to: 'scene' }]).state;
  expect(apply(torn, [{ op: 'move', id: 'letter', from: 'scene', to: 'player' }]).state.entities.letter.condition).toBe('torn');
  const destroyed = apply(state, [{ op: 'condition', id: 'letter', condition: 'destroyed' }]).state;
  expect(() => apply(destroyed, [{ op: 'condition', id: 'letter', condition: 'intact' }])).toThrow();
  expect(() => apply(destroyed, [{ op: 'repair', id: 'letter', using: ['letter'] }])).toThrow();
});

test('claims cannot overwrite facts or change ownership', () => {
  const state = initialStoryState('family-guy');
  state.entities.cell = item('cell', 'player');
  state.facts.push('The fuel cell was removed from the ray.');
  const result = apply(state, [{ op: 'claim', speaker: 'peter', text: 'I burned the fuel cell this morning.' }]);
  expect(result.state.facts).toEqual(state.facts);
  expect(result.state.entities.cell.at).toBe('player');
  expect(result.state.claims).toHaveLength(1);
});

test('time, duplicate choices and unknown operations are validated without modifying state', () => {
  const state = initialStoryState('custom');
  expect(() => validateStoryTurn(JSON.stringify({ ...draft(), elapsedMinutes: -1 }), state)).toThrow();
  expect(() => apply(state, [{ op: 'replace_state', entities: {} }])).toThrow();
  const duplicate = draft(); duplicate.choices[1] = duplicate.choices[0];
  expect(() => validateStoryTurn(JSON.stringify(duplicate), state)).toThrow();
  expect(() => validateStoryTurn('```json\n{}\n```', state)).toThrow();
  expect(state.version).toBe(0);
});

test('completed goals cannot be silently rewritten or reopened', () => {
  const state = initialStoryState('a-farewell-to-arms');
  const goal = state.goals[0];
  const finished = apply(state, [{ op: 'goal', ...goal, done: true }]).state;
  expect(() => apply(finished, [{ op: 'goal', ...goal, done: false }])).toThrow();
  expect(() => apply(finished, [{ op: 'goal', ...goal, text: 'Something different', done: true }])).toThrow();
});

test('Workers AI gives structured JSON room without expanding legacy token limits', async () => {
  const inputs: any[] = [];
  const provider = new WorkersAiProvider({ run: async (_model: string, input: unknown) => { inputs.push(input); return { response: '{}' }; } } as any);
  await provider.generateText({ messages: [], maxTokens: 1800, structured: true });
  await provider.generateText({ messages: [], maxTokens: 1800 });
  expect(inputs[0].max_completion_tokens).toBe(1800);
  expect(inputs[0].response_format).toEqual({ type: 'json_object' });
  expect(inputs[1].response_format).toBeUndefined();
  expect(inputs[1].max_completion_tokens).toBe(320);
  expect(inputs).toHaveLength(2);
});
