import type { Game } from '../src/lib/types';

function normalize(value: string): string {
  return value.replace(/[\u2018\u2019\u201B`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"').replace(/[®™]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Explicit IDs must never silently fall back to a conflicting title match. */
export function resolveExistingGame(games: Game[], name: string, steamAppid: string | null): { game?: Game; conflict?: string } {
  const named = games.filter(g => [g.name, g.name_zh ?? '', ...(g.aliases ?? [])]
    .filter(Boolean).some(n => normalize(n) === normalize(name)));
  if (steamAppid) {
    const byId = games.find(g => g.external_ids?.steam === steamAppid);
    if (named.some(g => g !== byId)) {
      return { conflict: `Steam AppID ${steamAppid} 与名称「${name}」对应的现有条目不一致。` };
    }
    return { game: byId };
  }
  if (named.length > 1) return { conflict: `名称「${name}」对应多个游戏，请提供 Steam AppID。` };
  return { game: named[0] };
}
