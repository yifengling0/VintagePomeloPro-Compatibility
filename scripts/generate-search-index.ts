import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { loadGames } from './load';
import { toClientGames } from '../src/lib/games';

// Same CJK-aware tokenizer as the client (#src/scripts/database.ts).
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const parts = text
    .toLowerCase()
    .split(/[\s,.;:!?/\\_\-()\[\]{}"'“”<>@|+*^%$#]+/u);
  for (const part of parts) {
    if (!part) continue;
    const cjkRuns = part.match(/[\u3400-\u4dbf\u4e00-\u9fff]+/g);
    if (cjkRuns) {
      for (const run of cjkRuns) tokens.push(...run.split(''));
    }
    const ascii = part.replace(/[\u3400-\u4dbf\u4e00-\u9fff]+/g, '');
    if (ascii) tokens.push(ascii);
  }
  return tokens;
}

const games = loadGames().map(({ game }) => game);
const client = toClientGames(games);

const mini = new MiniSearch({
  fields: ['name', 'name_zh', 'aliases', 'developer', 'publisher', 'genres'],
  idField: 'slug',
  storeFields: ['slug'],
  tokenize,
  searchOptions: { combineWith: 'AND', prefix: true, fuzzy: 0.2 },
});
mini.addAll(
  client.map((g) => ({
    slug: g.slug,
    name: g.name,
    name_zh: g.name_zh ?? '',
    aliases: g.aliases,
    developer: g.developer,
    publisher: g.publisher,
    genres: g.genres,
  })),
);

const payload = {
  generatedAt: new Date().toISOString(),
  games: client,
};

const out = join(process.cwd(), 'public', 'search-index.json');
writeFileSync(out, JSON.stringify(payload), 'utf8');
console.log(`✓ generate-search-index: wrote ${client.length} games to public/search-index.json`);
