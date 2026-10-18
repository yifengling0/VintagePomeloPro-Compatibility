import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveExistingGame } from './match-game';
import { loadGames } from './load';
const games = loadGames().map(x => x.game);
const target = games.find(g => g.slug === 'don-t-starve')!;
test('matching ID resolves a translated or unfamiliar title', () => {
  assert.equal(resolveExistingGame(games, 'unfamiliar title', '219740').game, target);
});
test('unknown explicit ID cannot fall back to the same name', () => {
  const r = resolveExistingGame(games, target.name, '999999999');
  assert.ok(r.conflict); assert.equal(r.game, undefined);
});
test('another existing game ID conflicts with the named game', () => {
  const other = games.find(g => g.external_ids?.steam && g !== target)!;
  assert.ok(resolveExistingGame(games, target.name, other.external_ids!.steam!).conflict);
});
test('matching name and ID resolves normally', () => {
  assert.equal(resolveExistingGame(games, target.name, '219740').game, target);
});
test('name-only aliases and typographic quotes still match', () => {
  assert.equal(resolveExistingGame(games, 'Don’t Starve', null).game, target);
  assert.equal(resolveExistingGame(games, '饥荒', null).game, target);
});
test('unknown names remain eligible for metadata lookup', () => {
  assert.deepEqual(resolveExistingGame(games, 'new title', '999999999'), { game: undefined });
});
test('ambiguous names require review', () => {
  assert.ok(resolveExistingGame([target, {...target, slug:'different'}], target.name, null).conflict);
});
