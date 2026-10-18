import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadGames } from './load';
import type { Artwork } from '../src/lib/artwork';
const images = JSON.parse(readFileSync('data/game-images.json', 'utf8')) as Record<string, Artwork>;
const games = loadGames().map(x => x.game);
let total = 0;
let reviewed = 0;
for (const game of games) {
  const image = images[game.slug];
  if (!image) {
    console.log(`ℹ ${game.slug}: using the built-in labeled neutral title card until artwork is reviewed.`);
    continue;
  }
  reviewed++;
  assert.match(image.file, /^\/images\/games\/[a-z0-9-]+\.(webp|jpg|png|svg)$/);
  const file = join('public', image.file);
  assert.ok(existsSync(file), `${game.slug}: missing local image`);
  assert.ok(['official-artwork', 'title-card'].includes(image.kind));
  assert.ok(image.attribution && image.rights && image.source && image.reviewed_at);
  assert.match(image.reviewed_at, /^\d{4}-\d{2}-\d{2}$/);
  if (image.kind === 'official-artwork') assert.match(image.source, /^https:\/\//);
  const size = statSync(file).size;
  assert.ok(size <= 200_000, `${game.slug}: image exceeds 200 KB budget`);
  total += size;
  const metadata = await sharp(file).metadata();
  assert.ok(metadata.width && metadata.height, `${game.slug}: invalid dimensions`);
  assert.ok(metadata.width <= 1200 && metadata.height <= 1200, `${game.slug}: image too large`);
  if (file.endsWith('.svg')) {
    const svg = readFileSync(file, 'utf8');
    assert.ok(!/<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=/i.test(svg), 'SVG must be self-contained and inert');
  }
}
for (const slug of Object.keys(images)) assert.ok(games.some(g => g.slug === slug), `unknown game artwork: ${slug}`);
console.log(`✓ validate-artwork: ${reviewed} local images, ${games.length - reviewed} neutral fallbacks, ${(total / 1024).toFixed(1)} KiB, provenance complete. Visual review is recorded separately; this script does not classify image content.`);
