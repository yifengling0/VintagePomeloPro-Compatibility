import type { Game, Report, Status } from './types';

export interface StatusMeta {
  label: string;
  zh: string;
  emoji: string;
  badge: string; // tailwind classes for the badge
  dot: string; // tailwind classes for a dot
  order: number;
}

export const STATUS_META: Record<Status, StatusMeta> = {
  perfect: {
    label: 'Perfect',
    zh: '完美',
    emoji: '🟢',
    badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    dot: 'bg-emerald-400',
    order: 0,
  },
  playable: {
    label: 'Playable',
    zh: '可玩',
    emoji: '🟢',
    badge: 'bg-green-500/15 text-green-300 ring-green-500/30',
    dot: 'bg-green-400',
    order: 1,
  },
  minor_issues: {
    label: 'Minor Issues',
    zh: '小问题',
    emoji: '🟡',
    badge: 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30',
    dot: 'bg-yellow-400',
    order: 2,
  },
  major_issues: {
    label: 'Major Issues',
    zh: '严重问题',
    emoji: '🟠',
    badge: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
    dot: 'bg-orange-400',
    order: 3,
  },
  broken: {
    label: 'Broken',
    zh: '不可用',
    emoji: '🔴',
    badge: 'bg-red-500/15 text-red-300 ring-red-500/30',
    dot: 'bg-red-400',
    order: 4,
  },
  unknown: {
    label: 'Unknown',
    zh: '未知',
    emoji: '⚪',
    badge: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    dot: 'bg-slate-400',
    order: 5,
  },
};

export const STATUS_ORDER: Status[] = [
  'perfect',
  'playable',
  'minor_issues',
  'major_issues',
  'broken',
  'unknown',
];

export function isStatus(value: string): value is Status {
  return (STATUS_ORDER as string[]).includes(value);
}

/** Compare two version strings (e.g. "2.6.2" vs "1.10.3") numerically. */
function compareVersion(a?: string | null, b?: string | null): number {
  const na = parseVersion(a);
  const nb = parseVersion(b);
  const len = Math.max(na.length, nb.length);
  for (let i = 0; i < len; i++) {
    const va = na[i] ?? 0;
    const vb = nb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function parseVersion(v?: string | null): number[] {
  return (v ?? '')
    .split('.')
    .map((x) => {
      const n = parseInt(x, 10);
      return Number.isNaN(n) ? 0 : n;
    });
}

/**
 * Sort reports newest-first, matching VPP status policy:
 * newest tested_at, then newest WineHua version, then newest renderer version.
 */
export function sortReports(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => {
    if (a.tested_at !== b.tested_at) return a.tested_at > b.tested_at ? -1 : 1;
    const wine = compareVersion(b.winehua_version, a.winehua_version);
    if (wine !== 0) return wine;
    const renderer = compareVersion(b.renderer?.version, a.renderer?.version);
    if (renderer !== 0) return renderer;
    return b.report_id.localeCompare(a.report_id);
  });
}

export function latestReport(game: Game): Report {
  return sortReports(game.reports)[0];
}

/** The "current" game status is derived from the newest report, never guessed. */
export function currentStatus(game: Game): Status {
  return latestReport(game).status;
}

export function sortByUpdatedAt(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) =>
      b.updated_at.localeCompare(a.updated_at) || b.release_year - a.release_year || a.name.localeCompare(b.name),
  );
}
