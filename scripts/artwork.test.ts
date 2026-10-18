import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artworkFor, artworkUrl } from '../src/lib/artwork';
import { toClientGames } from '../src/lib/games';
import { loadGames } from './load';
test('unknown games use neutral fallback without a remote image', () => {
  assert.equal(artworkFor('new-game'), undefined);
  assert.equal(artworkUrl('new-game'), null);
});
test('reviewed art has a Pages-compatible local URL even outside Vite', () => {
  assert.equal(artworkUrl('white-album-2'), '/VintagePomeloPro-Compatibility/images/games/white-album-2.jpg');
});
test('games serialize reviewed images or an explicit neutral fallback', () => {
  const games=loadGames().map(x=>x.game);
  const client=toClientGames(games);
  assert.equal(client.length, games.length);
  for (const g of client) {
    if (artworkFor(g.slug)) assert.ok(g.artwork?.startsWith('/VintagePomeloPro-Compatibility/images/games/'));
    else assert.equal(g.artwork, null);
  }
});
