import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { loadGames } from './load';

const SCHEMA_PATH = join(process.cwd(), 'schemas', 'game.schema.json');
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const errors: string[] = [];

function report(file: string, message: string): void {
  errors.push(`${file}: ${message}`);
}

for (const { file, game } of loadGames()) {
  if (!validate(game)) {
    for (const err of validate.errors ?? []) {
      const path = err.instancePath || '(root)';
      report(file, `${path} ${err.message}`);
    }
    continue;
  }

  // Consistency checks beyond the schema.
  const dateYear = new Date(`${game.release_date}T00:00:00Z`).getUTCFullYear();
  if (!Number.isNaN(dateYear) && dateYear !== game.release_year) {
    report(file, `release_year ${game.release_year} does not match release_date ${game.release_date}`);
  }
  if (game.id !== game.slug) {
    report(file, `id "${game.id}" does not equal slug "${game.slug}"`);
  }
  if (game.updated_at < game.created_at) {
    report(file, `updated_at (${game.updated_at}) is earlier than created_at (${game.created_at})`);
  }
  if (!game.name.trim()) {
    report(file, 'name is empty');
  }
  if (!game.reports.length) {
    report(file, 'no reports defined');
  }

  const ids = new Set<string>();
  for (const r of game.reports) {
    if (ids.has(r.report_id)) {
      report(file, `duplicate report_id "${r.report_id}" within the same game`);
    }
    ids.add(r.report_id);
    if (!r.tested_at) report(file, `report ${r.report_id} missing tested_at`);
    if (!r.status) report(file, `report ${r.report_id} missing status`);
  }
}

if (errors.length) {
  console.error(`✕ Schema validation failed (${errors.length} errors):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ validate-games: ${loadGames().length} game files passed schema + consistency checks.`);
