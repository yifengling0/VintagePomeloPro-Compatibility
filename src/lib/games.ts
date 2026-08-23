import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { ClientGame, Game } from './types';
import { summarize } from './filters';

const DATA_DIR = join(process.cwd(), 'data', 'games');

let cache: Game[] | null = null;

export function loadGames(): Game[] {
  if (cache) return cache;
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
  const games: Game[] = [];
  for (const file of files) {
    const raw = readFileSync(join(DATA_DIR, file), 'utf8');
    const doc = parse(raw) as Game;
    games.push(doc);
  }
  cache = games;
  return games;
}

export function getGames(): Game[] {
  return loadGames();
}

export function getGame(slug: string): Game | undefined {
  return loadGames().find((g) => g.slug === slug);
}

/** Minimal, safe object embedded into the page for the client-side database UI. */
export function toClientGames(games: Game[]): ClientGame[] {
  return games.map((g) => {
    const s = summarize(g);
    return {
      slug: g.slug,
      name: g.name,
      name_zh: g.name_zh ?? null,
      release_year: g.release_year,
      developer: g.developer ?? [],
      publisher: g.publisher ?? [],
      genres: g.genres ?? [],
      status: s.status,
      winehua_version: s.winehua_version,
      renderer: s.renderer,
      renderer_version: s.renderer_version,
      gpu: s.gpu,
      device_model: s.device_model,
      updated_at: g.updated_at,
      aliases: g.aliases ?? [],
    };
  });
}
