import { expect, test } from 'vitest';
import { parseStoryReply, visibleStoryPrefix } from '../src/story/memory';

test('plain prose stays usable and optional memory is independent', () => {
  expect(parseStoryReply('A scene.')).toEqual({ response: 'A scene.' });
  expect(parseStoryReply('A scene.\n<session_memory>Anything worth remembering.</session_memory>')).toEqual({ response: 'A scene.', memory: 'Anything worth remembering.' });
  expect(parseStoryReply('A scene.<session_memory>unfinished')).toEqual({ response: 'A scene.' });
});

test('every split of the private marker stays hidden', () => {
  const raw = 'A scene.<session_memory>Secret.</session_memory>';
  for (let i = 'A scene.'.length; i <= raw.length; i++) expect(visibleStoryPrefix(raw.slice(0, i))).toBe('A scene.');
});
