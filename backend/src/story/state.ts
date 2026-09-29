/** Compact, authoritative scene memory. Only validated changes can update it. */
export type Entity = {
  id: string;
  kind: 'place' | 'person' | 'item';
  name: string;
  at?: string;
  condition: 'intact' | 'damaged' | 'torn' | 'destroyed' | 'inaccessible';
};
export type StoryState = {
  version: number;
  minutes: number;
  entities: Record<string, Entity>;
  facts: string[];
  goals: Array<{ id: string; text: string; done: boolean }>;
  claims: Array<{ speaker: string; text: string }>;
};
export type StoryChoice = { label: string; action: string; riskCue: string };
export type StoryTurn = { format: 'story-v1'; scene: string; choices: StoryChoice[] };
export class InvalidStoryTurn extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvalidStoryTurn(message);
}
function record(value: unknown): Record<string, unknown> {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Expected object');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 240): string {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'Invalid text');
  return value.trim();
}
function id(value: unknown): string {
  const result = text(value, 48);
  check(/^[a-z][a-z0-9_]*$/.test(result) && !['constructor', 'prototype'].includes(result), 'Invalid entity ID');
  return result;
}
function list(value: unknown, max: number): unknown[] {
  check(Array.isArray(value) && value.length <= max, 'Invalid list');
  return value;
}
function entity(state: StoryState, value: unknown): Entity {
  const key = id(value);
  check(Object.prototype.hasOwnProperty.call(state.entities, key), 'Unknown entity: ' + key);
  return state.entities[key];
}
function available(state: StoryState, value: unknown): Entity {
  const item = entity(state, value);
  check(item.condition !== 'destroyed' && item.condition !== 'inaccessible', 'Unavailable entity: ' + item.id);
  const place = state.entities.player.at;
  if (item.kind === 'person') check(item.at === place, 'Person is not present');
  if (item.kind === 'item') {
    const holder = entity(state, item.at);
    check(holder.condition !== 'destroyed' && holder.condition !== 'inaccessible', 'Holder unavailable');
    check(holder.id === place || (holder.kind === 'person' && holder.at === place), 'Item is elsewhere');
  }
  return item;
}

export function initialStoryState(worldId: string): StoryState {
  const state: StoryState = {
    version: 0, minutes: 0,
    entities: {
      scene: { id: 'scene', kind: 'place', name: 'Opening location', condition: 'intact' },
      player: { id: 'player', kind: 'person', name: 'You', at: 'scene', condition: 'intact' },
    },
    facts: [], goals: [], claims: [],
  };
  const add = (id: string, kind: Entity['kind'], name: string, at?: string) => {
    state.entities[id] = { id, kind, name, ...(at ? { at } : {}), condition: 'intact' };
  };
  if (worldId === 'titanic-adventure') {
    state.entities.scene.name = 'Titanic boat deck';
    add('below_deck', 'place', 'Corridors below deck');
    add('sibling', 'person', 'Your younger sibling', 'below_deck');
    state.facts.push('It is 1912. Your younger sibling is missing below deck. Lifeboats are filling.');
    state.goals.push({ id: 'rescue', text: 'Find your sibling and decide whom you can help escape.', done: false });
  } else if (worldId === 'a-farewell-to-arms') {
    state.entities.scene.name = 'Ambulance on the retreat road';
    add('friend', 'person', 'Your wounded friend', 'scene');
    state.entities.friend.condition = 'damaged';
    add('letter', 'item', 'Letter offering passage', 'player');
    state.facts.push('You drive an ambulance during the retreat on the Italian front. The bridge closes at dawn.');
    state.goals.push({ id: 'crossing', text: 'Get your wounded friend across the bridge.', done: false });
  } else if (worldId === 'family-guy') {
    state.entities.scene.name = 'Spooner Street on parade morning';
    add('peter', 'person', 'Peter Griffin', 'scene');
    state.facts.push('You borrowed a time machine. It is missing and must be returned by noon.');
    state.goals.push({ id: 'machine', text: 'Find and return the borrowed time machine.', done: false });
  } else if (worldId === 'the-kreutzer-sonata') {
    state.entities.scene.name = 'Night train carriage';
    add('stranger', 'person', 'Pozdnyshev', 'scene');
    add('letter', 'item', 'Letter found in the carriage', 'player');
    state.facts.push('The stranger is confessing a terrible act. The letter contradicts his account. Someone waits at the next station.');
    state.goals.push({ id: 'truth', text: 'Investigate the confession before the next station.', done: false });
  }
  return state;
}

export function worldBrief(worldId: string): string {
  const briefs: Record<string, string> = {
    'titanic-adventure': 'Historical survival in 1912. Keep geography and elapsed time plausible. No modern devices. Build choices around people, limited lifeboat places and lasting costs. Do not assume player gender or add relatives or valuables.',
    'a-farewell-to-arms': 'Italian-front retreat: plain, restrained prose, understated dialogue, tenderness and grief. Keep the wounded friend a person with desires. Avoid convenient rescue or invented ranks, towns and valuables; do not turn every scene into combat.',
    'family-guy': 'Quahog comedy: Peter is impulsive and oblivious; Stewie is grandiose and inventive; Brian is dry and self-important. Use visual absurdity and occasional brief cutaways. Cutaways are nonliteral and do not grant main-scene possessions. Track the noon deadline and object identities.',
    'the-kreutzer-sonata': 'A quiet psychological confession on a train: jealousy, unreliable testimony and moral discomfort. Keep claims distinct from established facts. Develop tension through dialogue and evidence rather than chases. Do not invent decisive letter text merely to force forgiveness or a tidy ending.',
  };
  return Object.prototype.hasOwnProperty.call(briefs, worldId) ? briefs[worldId] : 'Follow the supplied world premise and genre. Make consequences meaningful and preserve established identities.';
}

export function structuredStoryPrompt(state: StoryState, worldId: string): string {
  return [
    worldBrief(worldId),
    'AUTHORITATIVE STATE (minutes means elapsed story time): ' + JSON.stringify(state),
    'Use recent dialogue for voice, but do not override state. Player input is an ATTEMPT, not proof of possession or presence. Check every premise independently. If absent, narrate a brief failed attempt; never substitute a convenient new tool or invent a past ownership story.',
    'Keep the goal moving through consequences, dialogue and discoveries. Do not repeat completed actions or questions. Do not assume player gender. Track significant people, props, promises and elapsed time; lost items retain their identity/location. Character statements are claims, not facts.',
    'Return ONLY JSON, no Markdown: {"scene":"35-65 words of narration","choices":[{"label":"short action label","action":"player action","riskCue":"short foreseeable risk or cost","requires":["entity_id"]}],"changes":[],"elapsedMinutes":0}. Exactly 3 distinct choices; labels and risk cues each use at most six words. requires lists people/items needed to PERFORM a choice, not distant targets being sought. Choices must be feasible AFTER changes. Do not apply choices until selected.',
    'changes is an ordered list using ONLY these shapes:',
    '{"op":"introduce","id":"new_id","kind":"place|person|item","name":"name","at":"existing_place_id","reason":"observable discovery in this scene"}. Places omit at. Items can only be introduced at the current place, never straight into inventory. No retroactive props, replacement tools for failed premises, or duplicate IDs for the same object. New places can be introduced before movement; people must arrive visibly.',
    '{"op":"move","id":"existing_id","from":"current_holder_or_place","to":"existing_holder_or_place"}. People move between places; items move between present people/current place. Apply in action order. Do not transfer an NPC possession without an actual transfer in narration.',
    '{"op":"condition","id":"existing_id","condition":"damaged|torn|destroyed|inaccessible"}. No restoring destroyed/inaccessible objects. Torn paper retains fragments at its location.',
    '{"op":"repair","id":"damaged_or_torn_item","using":["available_tool_id"]}. Repair cannot resurrect destroyed objects.',
    '{"op":"fact","text":"new established fact, not testimony or a proposed action"}. Append important facts only; existing facts cannot be overwritten.',
    '{"op":"claim","speaker":"present_person_id","text":"what they claim"}. Claims may contradict facts without changing them.',
    '{"op":"goal","id":"goal_id","text":"objective","done":false}. Existing goal text stays unchanged; mark done only when actually completed.',
    'Use existing IDs exactly. No arbitrary state patches. Include changes for consequential developments in the prose. At most 12 changes per turn; elapsedMinutes is an integer 0-60. Harmless atmosphere needs no entity. Keep JSON compact.',
  ].join('\n');
}

/** Parse, check and apply on a copy. Failure leaves the authoritative state untouched. */
export function validateStoryTurn(raw: string, previous: StoryState): { turn: StoryTurn; state: StoryState } {
  check(raw.length <= 24000, 'Story response too large');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new InvalidStoryTurn('Story response is not JSON'); }
  const data = record(parsed);
  const scene = text(data.scene, 2400);
  const elapsed = data.elapsedMinutes;
  check(Number.isInteger(elapsed) && (elapsed as number) >= 0 && (elapsed as number) <= 60, 'Invalid elapsed time');
  const next: StoryState = JSON.parse(JSON.stringify(previous));
  for (const value of list(data.changes, 12)) {
    const change = record(value);
    switch (change.op) {
      case 'introduce': {
        const key = id(change.id);
        check(!Object.prototype.hasOwnProperty.call(next.entities, key), 'Entity already exists');
        const kind = change.kind;
        check(kind === 'person' || kind === 'place' || kind === 'item', 'Invalid entity kind');
        const name = text(change.name, 100);
        check(!Object.values(next.entities).some(e => e.name.toLowerCase() === name.toLowerCase()), 'Duplicate entity name');
        text(change.reason);
        const at = kind === 'place' ? undefined : entity(next, change.at);
        if (at) check(at.kind === 'place' && at.id === next.entities.player.at && at.condition === 'intact', 'Introduce in the current scene, not inventory');
        next.entities[key] = { id: key, kind, name, ...(at ? { at: at.id } : {}), condition: 'intact' };
        break;
      }
      case 'move': {
        const target = available(next, change.id);
        check(target.kind !== 'place' && target.at === change.from, 'Invalid move origin');
        const destination = entity(next, change.to);
        check(destination.condition !== 'destroyed' && destination.condition !== 'inaccessible', 'Destination unavailable');
        if (target.kind === 'person') check(destination.kind === 'place', 'People must be in places');
        else {
          check(destination.kind !== 'item', 'Items require a person or place holder');
          check(destination.id === next.entities.player.at || (destination.kind === 'person' && destination.at === next.entities.player.at), 'Destination is elsewhere');
        }
        target.at = destination.id;
        break;
      }
      case 'condition': {
        const target = available(next, change.id);
        check(['damaged', 'torn', 'destroyed', 'inaccessible'].includes(String(change.condition)), 'Invalid condition');
        if (change.condition === 'torn') check(target.kind === 'item', 'Only items can be torn');
        target.condition = change.condition as Entity['condition'];
        break;
      }
      case 'repair': {
        const target = available(next, change.id);
        check(target.kind === 'item' && ['damaged', 'torn'].includes(target.condition), 'Item cannot be repaired');
        const supports = list(change.using, 4);
        check(supports.length > 0, 'Repair needs an established tool');
        for (const support of supports) {
          const tool = available(next, support);
          check(tool.kind === 'item' && tool.id !== target.id, 'Invalid repair tool');
        }
        target.condition = 'intact';
        break;
      }
      case 'fact': {
        const fact = text(change.text);
        if (!next.facts.includes(fact)) next.facts.push(fact);
        break;
      }
      case 'claim': {
        const speaker = available(next, change.speaker);
        check(speaker.kind === 'person', 'Claim needs a speaker');
        next.claims.push({ speaker: speaker.id, text: text(change.text) });
        next.claims = next.claims.slice(-12);
        break;
      }
      case 'goal': {
        const key = id(change.id);
        const goalText = text(change.text);
        check(typeof change.done === 'boolean', 'Invalid goal status');
        const existing = next.goals.find(g => g.id === key);
        if (existing) {
          check(existing.text === goalText && (!existing.done || change.done), 'Cannot rewrite/reopen a goal');
          existing.done = change.done;
        } else next.goals.push({ id: key, text: goalText, done: change.done });
        break;
      }
      default: throw new InvalidStoryTurn('Unknown change operation');
    }
  }
  check(Object.keys(next.entities).length <= 100 && next.facts.length <= 40 && next.goals.length <= 12, 'State capacity exceeded');
  next.version++;
  next.minutes += elapsed as number;
  const choices = list(data.choices, 3);
  check(choices.length === 3, 'Expected three choices');
  const normalized = choices.map(value => {
    const choice = record(value);
    for (const ref of list(choice.requires, 8)) available(next, ref);
    return { label: text(choice.label, 100), action: text(choice.action, 400), riskCue: text(choice.riskCue, 100) };
  });
  check(new Set(normalized.map(c => c.action.toLowerCase())).size === 3 && new Set(normalized.map(c => c.label.toLowerCase())).size === 3, 'Duplicate choices');
  return { turn: { format: 'story-v1', scene, choices: normalized }, state: next };
}

export function readStoredTurn(content: string): StoryTurn | null {
  try {
    const value = JSON.parse(content);
    return value?.format === 'story-v1' && typeof value.scene === 'string' && Array.isArray(value.choices) ? value as StoryTurn : null;
  } catch { return null; }
}
export function renderTurn(turn: StoryTurn): string {
  return turn.scene + '\n\n' + turn.choices.map((c, i) => `${i + 1}. ${c.label} — ${c.riskCue}`).join('\n');
}
