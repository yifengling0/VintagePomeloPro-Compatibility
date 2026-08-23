import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { ClientGame, Game } from './types';
import { summarize, summarizeFor } from './filters';
import { APPS } from './apps';

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
    const latest = summarize(g);
    const by_app: Record<string, ClientGame['latest']> = {};
    for (const a of APPS) {
      const s = summarizeFor(g, a.id);
      if (s) by_app[a.id] = s;
    }
    return {
      slug: g.slug,
      name: g.name,
      name_zh: g.name_zh ?? null,
      release_year: g.release_year,
      developer: g.developer ?? [],
      publisher: g.publisher ?? [],
      genres: g.genres ?? [],
      aliases: g.aliases ?? [],
      updated_at: g.updated_at,
      latest,
      by_app,
    };
  });
}
