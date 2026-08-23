/**
 * Astro's `base` option does NOT rewrite hard-coded <a href="/...">
 * for statically exported sites. Use these helpers everywhere so links
 * work both locally (base "/") and on GitHub Pages (base "/VintagePomeloPro-Compatibility/").
 */
export const BASE = import.meta.env.BASE_URL;

function trimTrailing(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function withBase(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${trimTrailing(BASE)}${normalized}`;
}

export function baseHref(): string {
  return trimTrailing(BASE) || '/';
}
