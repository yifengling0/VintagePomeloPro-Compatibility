import { loadGames } from './load';

const errors: string[] = [];

const idToFile = new Map<string, string>();
const slugToFile = new Map<string, string>();
const steamToFile = new Map<string, string>();
const igdbToFile = new Map<string, string>();
const reportIdToFile = new Map<string, string>();
const titleYearToFile = new Map<string, string>();

function collide(map: Map<string, string>, key: string, file: string, kind: string): void {
  const existing = map.get(key);
  if (existing && existing !== file) {
    errors.push(`${key}: ${kind} used by both ${existing} and ${file}`);
  } else {
    map.set(key, file);
  }
}

for (const { file, game } of loadGames()) {
  collide(idToFile, game.id, file, 'id');
  collide(slugToFile, game.slug, file, 'slug');

  const steam = game.external_ids?.steam;
  if (steam) collide(steamToFile, steam, file, 'Steam AppID');
  const igdb = game.external_ids?.igdb;
  if (igdb) collide(igdbToFile, igdb, file, 'IGDB ID');

  const titleKey = `${game.name.trim().toLowerCase()}::${game.release_year}`;
  collide(titleYearToFile, titleKey, file, 'canonical title + year');

  for (const r of game.reports) {
    collide(reportIdToFile, r.report_id, file, 'report_id');
  }
}

if (errors.length) {
  console.error(`✕ Duplicate check failed (${errors.length} collisions):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('✓ find-duplicates: no duplicate ids, slugs, external IDs, title+year or report_ids detected.');
