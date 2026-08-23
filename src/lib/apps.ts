/**
 * Maintainable list of apps this compatibility database tracks (旧柚 / 旧柚Pro).
 * To add a new app, append an entry here and make the relevant reports use its `id`.
 */
export interface AppMeta {
  id: string;
  name: string; // official English name
  name_zh: string; // primary Chinese display name
}

export const APPS: AppMeta[] = [
  { id: 'vintagepomelopro', name: 'VintagePomeloPro', name_zh: '旧柚 Pro' },
  { id: 'vintagepomelo', name: 'VintagePomelo', name_zh: '旧柚' },
];

export function appMeta(id: string): AppMeta {
  return APPS.find((a) => a.id === id) ?? { id, name: id, name_zh: id };
}

export function appLabel(id: string): string {
  return appMeta(id).name_zh;
}

export function isKnownApp(id: string): boolean {
  return APPS.some((a) => a.id === id);
}
