import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Game } from '../src/lib/types';

const DATA_DIR = join(process.cwd(), 'data', 'games');

export function listGameFiles(): string[] {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
}

export interface LoadedGame {
  file: string;
  game: Game;
}

export function loadGames(): LoadedGame[] {
  return listGameFiles().map((file) => {
    const raw = readFileSync(join(DATA_DIR, file), 'utf8');
    const game = parse(raw) as Game;
    return { file, game };
  });
}
