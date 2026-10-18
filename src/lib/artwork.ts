import images from '../../data/game-images.json';
import { withBase } from './url';

export interface Artwork {
  file: string;
  kind: 'official-artwork' | 'title-card';
  source: string;
  attribution: string;
  rights: string;
  reviewed_at: string;
}
const registry = images as Record<string, Artwork>;
export function artworkFor(slug: string): Artwork | undefined { return registry[slug]; }
export function artworkUrl(slug: string): string | null {
  const file = artworkFor(slug)?.file;
  // Reviewed local files only. Never infer a remote cover from a store ID.
  return file && /^\/images\/games\/[a-z0-9-]+\.(webp|jpg|png|svg)$/.test(file) ? withBase(file) : null;
}
