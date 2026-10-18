import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentStatus } from '../src/lib/status';
import { loadGames } from './load';
import { readFileSync } from 'node:fs';
test('append-only report history uses newest status, not the first array item', () => {
  const base = loadGames()[0].game;
  const fixture = {...base, reports: [
    {...base.reports[0], report_id:'older', tested_at:'2026-10-12', status:'major_issues' as const},
    {...base.reports[0], report_id:'newer', tested_at:'2026-10-17', status:'perfect' as const},
  ]};
  assert.equal(currentStatus(fixture), 'perfect');
  assert.equal(fixture.reports[0].status, 'major_issues');
});
test('recent strip shares currentStatus rather than selecting the first report', () => {
  const component=readFileSync('src/components/RecentStrip.astro','utf8');
  assert.match(component, /currentStatus\(game\)/);
  assert.doesNotMatch(component, /reports\[0\]/);
});
