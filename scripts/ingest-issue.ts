#!/usr/bin/env tsx
/**
 * Compatibility Agent v1 (docs/agent/AGENT_GUIDELINE.md, steps 1-11).
 *
 * Converts one GitHub compatibility-report issue into a data/games change:
 *   appended     the reported game matches an existing entry -> append the report
 *   created      new game, identity confirmed via Steam    -> new YAML file
 *   needs-review identity/metadata cannot be confirmed      -> maintainer comment
 *   skipped      issue closed or already processed
 *
 * Metadata is never invented (docs/agent/METADATA_POLICY.md): new game files
 * are only produced from a verified Steam match (user-supplied AppID or an
 * unambiguous store-search hit); everything else is handed to a maintainer.
 *
 * Usage:
 *   npx tsx scripts/ingest-issue.ts <issue-number> [--out-dir <dir>] [--force]
 *       [--body-file <file> --author <login> --created <ISO>]
 *
 * With --body-file the GitHub API is not contacted (offline testing); the
 * default out-dir is the working directory and the following files are written:
 *   agent-result.json  machine-readable outcome (consumed by the workflow)
 *   agent-pr-body.md   PR body, when a data file was written
 *   agent-comment.md   issue comment, for needs-review
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse, stringify } from 'yaml';
import { loadGames } from './load';
import { isKnownApp } from '../src/lib/apps';
import type { Game, Renderer, Report, Status } from '../src/lib/types';

const REPO = process.env.GITHUB_REPOSITORY ?? 'yifengling0/VintagePomeloPro-Compatibility';
const TOKEN = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
const ISSUE_NUMBER = Number(process.argv[2] ?? 0) || 0;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const OUT_DIR = argValue('--out-dir') ?? '.';
const BODY_FILE = argValue('--body-file');
const AUTHOR = argValue('--author') ?? 'unknown';
const CREATED = argValue('--created') ?? `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
const FORCE = process.argv.includes('--force');

const TODAY = new Date().toISOString().slice(0, 10);
const ISSUE_URL = (n: number) => `https://github.com/${REPO}/issues/${n}`;

type Action = 'created' | 'appended' | 'needs-review' | 'skipped';

interface Result {
  action: Action;
  issue: number;
  reason?: string;
  slug?: string;
  file?: string;
  branch?: string;
  pr_title?: string;
  confidence?: string;
  steam_appid?: string;
  candidates?: { appid: number; name: string; url: string }[];
}

// ---------------------------------------------------------------------------
// GitHub issue input
// ---------------------------------------------------------------------------

interface IssueInfo {
  number: number;
  title: string;
  body: string;
  state: string;
  user: string;
  created_at: string;
  labels: string[];
}

async function ghGet(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'vpp-compatibility-agent',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}`);
  return res.json();
}

async function fetchIssue(number: number): Promise<IssueInfo> {
  const raw = (await ghGet(`/repos/${REPO}/issues/${number}`)) as {
    title: string;
    body: string;
    state: string;
    created_at: string;
    user: { login: string };
    labels: { name: string }[];
  };
  return {
    number,
    title: raw.title,
    body: raw.body ?? '',
    state: raw.state,
    user: raw.user?.login ?? 'unknown',
    created_at: raw.created_at,
    labels: raw.labels.map((l) => l.name),
  };
}

/** Parse a GitHub issue-form body ("### label" sections) into a map. */
function parseIssueForm(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let label: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (label) {
      const value = buffer.join('\n').trim();
      fields[label] = value === '_No response_' ? '' : value;
    }
  };
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const m = /^### (.+?)\s*$/.exec(line);
    if (m) {
      flush();
      label = m[1].trim();
      buffer = [];
    } else if (label !== null) {
      buffer.push(line);
    }
  }
  flush();
  return fields;
}

// ---------------------------------------------------------------------------
// Form value mapping (labels come from .github/ISSUE_TEMPLATE/compatibility-report.yml)
// ---------------------------------------------------------------------------

const APP_MAP: Record<string, string> = {
  '旧柚 Pro (VintagePomeloPro)': 'vintagepomelopro',
  '旧柚 (VintagePomelo)': 'vintagepomelo',
  '其他 / 不确定': 'unknown',
};

const RENDERER_MAP: Record<string, Renderer> = {
  DXVK: 'dxvk',
  VKD3D: 'vkd3d',
  WineD3D: 'wined3d',
  VirGL: 'virgl',
  'Native OpenGL': 'native_opengl',
  '其他 / 不确定': 'other',
};

const STATUS_MAP: Record<string, Status> = {
  完美: 'perfect',
  可玩: 'playable',
  小问题: 'minor_issues',
  严重问题: 'major_issues',
  不可用: 'broken',
  未知: 'unknown',
};

function mapStatus(value: string): Status | null {
  const v = value.trim();
  for (const [key, status] of Object.entries(STATUS_MAP)) {
    if (v.includes(key)) return status;
  }
  for (const status of Object.values(STATUS_MAP)) {
    if (v.toLowerCase().includes(status)) return status;
  }
  return null;
}

function mapGraphicsApi(value: string): string | null {
  const v = value.toLowerCase();
  if (!v.trim()) return null;
  for (const api of ['d3d12', 'd3d11', 'd3d10', 'd3d9', 'vulkan', 'opengl'] as const) {
    if (v.includes(api)) return api;
  }
  return 'other';
}

function mapArchitecture(value: string): 'x86' | 'x64' | null {
  const v = value.trim().toLowerCase();
  if (v === 'x86' || v === 'x64') return v;
  return null;
}

function parseFps(value: string): number | null {
  const m = /\d+(?:\.\d+)?/.exec(value);
  return m ? Number(m[0]) : null;
}

function splitUrls(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//.test(s));
}

const VIDEO_RE = /(youtube\.com|youtu\.be|bilibili|\.mp4($|\?)|\.webm($|\?)|\.mov($|\?))/i;

const GPU_NORMALIZE: [RegExp, string][] = [
  [/马良\s*(\d{3})/g, 'Maleoon $1'],
];

function normalizeGpu(value: string): string {
  return GPU_NORMALIZE.reduce((v, [re, to]) => v.replace(re, to), value).trim();
}

function splitWorkarounds(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim().replace(/^[-*]\s*/, ''))
    .filter((s) => s && !/^(无|暂无|none)$/i.test(s));
}

// ---------------------------------------------------------------------------
// Existing-database matching
// ---------------------------------------------------------------------------

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function gameNameKeys(game: Game): string[] {
  return [game.name, game.name_zh ?? '', ...(game.aliases ?? [])]
    .filter((t) => t && t.trim())
    .map(norm);
}

function findExistingGame(games: Game[], name: string, steamAppid: string | null): Game | undefined {
  if (steamAppid) {
    const byId = games.find((g) => g.external_ids?.steam && String(g.external_ids.steam) === steamAppid);
    if (byId) return byId;
  }
  const n = norm(name);
  return games.find((g) => gameNameKeys(g).includes(n));
}

function hasReportId(games: Game[], reportId: string): boolean {
  return games.some((g) => g.reports.some((r) => r.report_id === reportId));
}

// ---------------------------------------------------------------------------
// Steam metadata lookup (https://store.steampowered.com/api)
// ---------------------------------------------------------------------------

interface SteamSearchItem {
  id: number;
  name: string;
}

interface SteamAppDetails {
  type: string;
  name: string;
  steam_appid: number;
  release_date: { coming_soon: boolean; date: string };
  developers?: string[];
  publishers?: string[];
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
  genres?: { description: string }[];
}

async function steamSearch(term: string, lang: 'english' | 'schinese'): Promise<SteamSearchItem[]> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&cc=US&l=${lang}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: SteamSearchItem[] };
    return json.items ?? [];
  } catch {
    return [];
  }
}

async function steamAppDetails(appid: number, lang: 'english' | 'schinese'): Promise<SteamAppDetails | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=${lang}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { success?: boolean; data?: SteamAppDetails }>;
    return json[String(appid)]?.success ? (json[String(appid)].data ?? null) : null;
  } catch {
    return null;
  }
}

const GENRE_DROP = new Set(['free to play', 'indie', 'casual']);

function mapSteamGenres(genres: { description: string }[] | undefined): string[] {
  const mapped = (genres ?? [])
    .map((g) => g.description.trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/\s+/g, '_'))
    .filter((g) => g && !GENRE_DROP.has(g));
  return [...new Set(mapped)].slice(0, 3);
}

function mapSteamPlatforms(p: SteamAppDetails['platforms']): string[] {
  const out: string[] = [];
  if (p?.windows) out.push('Windows');
  if (p?.mac) out.push('macOS');
  if (p?.linux) out.push('Linux');
  return out.length ? out : ['Windows'];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse Steam release dates: "Jan 5, 2024" / "18 Apr, 2011" (en) or "2024 年 1 月 5 日" (zh). */
function parseSteamReleaseDate(raw: string): string | null {
  const zh = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(raw);
  if (zh) {
    const [, y, m, d] = zh;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const s = raw.replace(/,/g, ' ');
  let month: number | null = null;
  for (const [key, value] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${key}`, 'i').test(s)) {
      month = value;
      break;
    }
  }
  const year = /\b(\d{4})\b/.exec(s);
  const day = /\b(\d{1,2})\b/.exec(s);
  if (month && year && day) {
    return `${year[1]}-${String(month).padStart(2, '0')}-${day[1].padStart(2, '0')}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  return iso ? iso[0] : null;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'game';
}

interface SteamMatch {
  appid: string;
  detailsEn: SteamAppDetails;
  detailsZh: SteamAppDetails | null;
}

async function matchSteam(name: string, userAppid: string | null): Promise<SteamMatch | 'ambiguous' | 'not-found'> {
  if (userAppid) {
    const detailsEn = await steamAppDetails(Number(userAppid), 'english');
    if (detailsEn && detailsEn.name) {
      const detailsZh = await steamAppDetails(Number(userAppid), 'schinese');
      return { appid: String(userAppid), detailsEn, detailsZh };
    }
    return 'not-found';
  }

  const [enItems, zhItems] = await Promise.all([steamSearch(name, 'english'), steamSearch(name, 'schinese')]);
  const items = [...enItems, ...zhItems];
  if (!items.length) return 'not-found';

  const unique = new Map<number, SteamSearchItem>();
  for (const item of items) unique.set(item.id, item);
  const n = norm(name);
  const exact = [...unique.values()].filter((item) => norm(item.name) === n);

  // Only adopt an identity that is unambiguous: a single hit, or exactly one
  // exact-title hit. Otherwise the report needs a maintainer.
  let chosen: SteamSearchItem | undefined;
  if (unique.size === 1) chosen = [...unique.values()][0];
  else if (exact.length === 1) chosen = exact[0];

  if (!chosen) return 'ambiguous';
  const detailsEn = await steamAppDetails(chosen.id, 'english');
  if (!detailsEn || detailsEn.type !== 'game') return 'ambiguous';
  const detailsZh = await steamAppDetails(chosen.id, 'schinese');
  return { appid: String(chosen.id), detailsEn, detailsZh };
}

// ---------------------------------------------------------------------------
// YAML rendering
// ---------------------------------------------------------------------------

const schema = JSON.parse(readFileSync(join(process.cwd(), 'schemas', 'game.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

function renderGameYaml(game: Game): string {
  return `# Game metadata + compatibility reports.\n${stringify(game, { lineWidth: 0 })}`;
}

function renderReportBlock(report: Report): string {
  const text = stringify(report, { lineWidth: 0 }).trimEnd();
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? `  - ${line}` : line ? `    ${line}` : ''))
    .join('\n');
}

function assertValidGameYaml(path: string, raw: string): void {
  const doc = parse(raw) as Game;
  if (!validateSchema(doc)) {
    const detail = (validateSchema.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join('; ');
    throw new Error(`generated file ${path} failed schema validation: ${detail}`);
  }
  const year = new Date(`${doc.release_date}T00:00:00Z`).getUTCFullYear();
  if (year !== doc.release_year) throw new Error(`release_year ${doc.release_year} != release_date ${doc.release_date}`);
  if (!isKnownApp(doc.reports[doc.reports.length - 1]!.app ?? '')) {
    throw new Error(`unknown app id in generated report`);
  }
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

function writeOut(dir: string, name: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

function buildReport(f: Record<string, string>, issue: IssueInfo): Report {
  const gameVersion = f['游戏版本'] ?? '';
  const description = f['问题描述'] ?? '';
  const notes = gameVersion ? `游戏版本 ${gameVersion}，${description}` : description;
  const evidenceUrls = splitUrls(f['截图 / 视频'] ?? '');
  return {
    report_id: `issue-${issue.number}`,
    source: {
      type: 'github_issue',
      issue: issue.number,
      user: issue.user,
      url: ISSUE_URL(issue.number),
    },
    tested_at: issue.created_at.slice(0, 10),
    app: APP_MAP[f['App'] ?? ''] ?? 'unknown',
    winehua_version: f['应用版本'] || null,
    device: {
      model: f['设备型号'] || null,
      soc: null,
      gpu: f['GPU'] ? normalizeGpu(f['GPU']) : null,
      os: f['HarmonyOS 版本'] ? 'HarmonyOS' : null,
      os_version: f['HarmonyOS 版本'] || null,
    },
    renderer: {
      backend: RENDERER_MAP[(f['渲染后端（Renderer）'] ?? '').trim()] ?? 'other',
      version: f['Renderer 版本'] || null,
    },
    graphics_api: { api: mapGraphicsApi(f['图形 API'] ?? '') },
    architecture: { game: mapArchitecture(f['游戏架构'] ?? ''), wine: null },
    status: mapStatus(f['兼容状态'] ?? '') ?? 'unknown',
    performance: {
      fps_avg: parseFps(f['平均 FPS'] ?? ''),
      fps_min: parseFps(f['最低 FPS'] ?? ''),
      fps_max: parseFps(f['最高 FPS'] ?? ''),
      resolution: f['分辨率'] || null,
    },
    symptoms: [],
    workarounds: splitWorkarounds(f['解决方法 / Workaround'] ?? ''),
    notes: notes || null,
    evidence: {
      screenshots: evidenceUrls.filter((u) => !VIDEO_RE.test(u)),
      logs: splitUrls(f['日志链接'] ?? ''),
      videos: evidenceUrls.filter((u) => VIDEO_RE.test(u)),
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!ISSUE_NUMBER) throw new Error('usage: ingest-issue.ts <issue-number> [--out-dir dir]');

  const issue = BODY_FILE
    ? {
        number: ISSUE_NUMBER,
        title: '',
        body: readFileSync(BODY_FILE, 'utf8'),
        state: 'open',
        user: AUTHOR,
        created_at: CREATED,
        labels: [],
      }
    : await fetchIssue(ISSUE_NUMBER);

  const result: Result = { action: 'skipped', issue: ISSUE_NUMBER };

  const done = () => {
    console.log(stringify(result));
    writeOut(OUT_DIR, 'agent-result.json', JSON.stringify(result, null, 2));
  };

  if (!BODY_FILE) {
    if (issue.state !== 'open') {
      result.reason = `issue is ${issue.state}`;
      return done();
    }
    if (issue.labels.includes('agent-complete') || issue.labels.includes('needs-review')) {
      result.reason = 'issue already processed by the agent';
      return done();
    }
  }

  const fields = parseIssueForm(issue.body);
  const name = (fields['游戏名称'] || issue.title.replace(/\[Compatibility\]/gi, '')).trim();
  const missing = (['游戏名称', 'App', '应用版本', '设备型号', '渲染后端（Renderer）', '兼容状态', '问题描述'] as const).filter(
    (key) => !fields[key]?.trim(),
  );
  if (!name || missing.length) {
    result.action = 'needs-review';
    result.reason = `missing required form fields: ${missing.join(', ') || '(empty game name)'}`;
    writeOut(
      OUT_DIR,
      'agent-comment.md',
      `兼容性 Agent 读取了本 issue，但缺少必填字段，无法生成数据：\n\n${missing
        .map((m) => `- ${m}`)
        .join('\n')}\n\n请补充信息后移除并重新添加 \`compatibility-report\` 标签以重新触发。`,
    );
    return done();
  }

  const games = loadGames().map((g) => g.game);
  const reportId = `issue-${issue.number}`;
  if (!FORCE && hasReportId(games, reportId)) {
    result.reason = `report ${reportId} already exists in the database`;
    return done();
  }

  const report = buildReport(fields, issue);
  const userAppid = (fields['Steam AppID'] ?? '').replace(/\D/g, '') || null;
  const existing = findExistingGame(games, name, userAppid);

  if (existing) {
    const raw = readFileSync(join(process.cwd(), 'data', 'games', `${existing.slug}.yaml`), 'utf8');
    const updated = raw
      .replace(/^updated_at:.*$/m, `updated_at: ${TODAY}`)
      .trimEnd();
    const content = `${updated}\n\n${renderReportBlock(report)}\n`;
    const file = join('data', 'games', `${existing.slug}.yaml`);
    writeFileSync(join(process.cwd(), file), content);
    assertValidGameYaml(file, content);

    result.action = 'appended';
    result.slug = existing.slug;
    result.file = file.replace(/\\/g, '/');
    result.branch = `agent/issue-${issue.number}-${existing.slug}`;
    result.pr_title = `[Compatibility] ${existing.name} - Issue #${issue.number}`;
    writeOut(OUT_DIR, 'agent-pr-body.md', prBody(issue, existing, report, null));
    console.error(`✓ appended report ${reportId} to ${file}`);
    return done();
  }

  // New game: only proceed on a verified Steam match, never guess metadata.
  const match = await matchSteam(name, userAppid);
  if (match === 'ambiguous' || match === 'not-found') {
    result.action = 'needs-review';
    result.reason = match === 'ambiguous' ? 'Steam search returned multiple candidates' : 'game not found on Steam';
    if (match === 'ambiguous' || match === 'not-found') {
      const seen = new Set<number>();
      const candidates: { appid: number; name: string; url: string }[] = [];
      for (const lang of ['english', 'schinese'] as const) {
        for (const item of await steamSearch(name, lang)) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          candidates.push({ appid: item.id, name: item.name, url: `https://store.steampowered.com/app/${item.id}/` });
          if (candidates.length >= 5) break;
        }
        if (candidates.length >= 5) break;
      }
      result.candidates = candidates;
    }
    writeOut(OUT_DIR, 'agent-comment.md', needsReviewComment(name, result.reason, result.candidates ?? []));
    console.error(`! needs-review: ${result.reason}`);
    return done();
  }

  const releaseDate = match.detailsEn.release_date.coming_soon
    ? null
    : parseSteamReleaseDate(match.detailsEn.release_date.date);
  if (!releaseDate) {
    result.action = 'needs-review';
    result.reason = `cannot parse Steam release date "${match.detailsEn.release_date.date}"`;
    writeOut(OUT_DIR, 'agent-comment.md', needsReviewComment(name, result.reason, []));
    return done();
  }

  const detailsZh = match.detailsZh;
  const nameZh =
    detailsZh && norm(detailsZh.name) !== norm(match.detailsEn.name)
      ? detailsZh.name
      : /[\u3400-\u9fff]/.test(name)
        ? name
        : null;

  const aliases = new Set<string>();
  if (norm(name) !== norm(match.detailsEn.name) && name !== nameZh) aliases.add(name);

  let slug = slugify(match.detailsEn.name);
  const takenSlugs = new Set(games.map((g) => g.slug));
  if (takenSlugs.has(slug)) slug = `${slug}-${releaseDate.slice(0, 4)}`;
  if (takenSlugs.has(slug)) slug = `${slug}-steam-${match.appid}`;

  const game: Game = {
    schema_version: 1,
    id: slug,
    slug,
    name: match.detailsEn.name,
    name_zh: nameZh,    aliases: [...aliases],
    release_date: releaseDate,
    release_year: Number(releaseDate.slice(0, 4)),
    developer: match.detailsEn.developers?.length ? match.detailsEn.developers : ['Unknown'],
    publisher: match.detailsEn.publishers?.length ? match.detailsEn.publishers : undefined,
    genres: mapSteamGenres(match.detailsEn.genres),
    platforms: mapSteamPlatforms(match.detailsEn.platforms),
    external_ids: { steam: match.appid, igdb: null, gog: null },
    metadata_sources: [
      { type: 'steam', id: match.appid, url: `https://store.steampowered.com/app/${match.appid}/` },
    ],
    metadata_confidence: 'high',
    created_at: TODAY,
    updated_at: TODAY,
    reports: [report],
  };
  if (!game.publisher?.length) delete game.publisher;
  if (!game.name_zh) delete game.name_zh;

  const file = join('data', 'games', `${slug}.yaml`);
  const content = renderGameYaml(game);
  writeFileSync(join(process.cwd(), file), content);
  assertValidGameYaml(file, content);

  result.action = 'created';
  result.slug = slug;
  result.file = file.replace(/\\/g, '/');
  result.branch = `agent/issue-${issue.number}-${slug}`;
  result.pr_title = `[Compatibility] ${game.name} - Issue #${issue.number}`;
  result.confidence = 'high';
  result.steam_appid = match.appid;
  writeOut(OUT_DIR, 'agent-pr-body.md', prBody(issue, game, report, match.appid));
  console.error(`✓ created ${file} (Steam AppID ${match.appid})`);
  done();
}

function prBody(issue: IssueInfo, game: Game, report: Report, steamAppid: string | null): string {
  const appLabel: Record<string, string> = {
    vintagepomelopro: '旧柚 Pro',
    vintagepomelo: '旧柚',
    unknown: '其他 / 不确定',
  };
  const lines = [
    '## Compatibility Agent 自动导入',
    '',
    `- **来源 Issue**：#${issue.number}（@${issue.user}，[原文](${ISSUE_URL(issue.number)})）`,
    `- **游戏**：${game.name}${game.name_zh ? `（${game.name_zh}）` : ''}`,
    steamAppid
      ? `- **操作**：新建 \`data/games/${game.slug}.yaml\`，元数据来自 Steam 商店页（AppID ${steamAppid}，置信度 high）`
      : `- **操作**：向 \`data/games/${game.slug}.yaml\` 追加报告 \`${report.report_id}\`（历史报告未改动）`,
    `- **兼容状态**：\`${report.status}\``,
    `- **App / 版本**：${appLabel[report.app ?? ''] ?? report.app} ${report.winehua_version ?? ''}`,
    `- **设备**：${report.device?.model ?? ''}（${report.device?.gpu ?? 'GPU 未填'}，HarmonyOS ${report.device?.os_version ?? ''}）`,
    `- **渲染**：${report.renderer?.backend ?? ''}${report.architecture?.game ? ` · ${report.architecture.game}` : ''}`,
    `- **描述**：${report.notes ?? ''}`,
    '',
    '### 维护者检查清单',
    '- [ ] 游戏身份与元数据核对',
    '- [x] Schema 校验 + 重复检测（生成脚本内置）',
    '- [ ] CI（Validate）通过后合并',
    '',
  ];
  return lines.join('\n');
}

function needsReviewComment(name: string, reason: string, candidates: { appid: number; name: string; url: string }[]): string {
  const lines = [
    `兼容性 Agent 无法唯一确认「**${name}**」这款游戏（${reason}），为避免臆造元数据，暂时没有生成数据文件。`,
    '',
  ];
  if (candidates.length) {
    lines.push('**Steam 商店里可能的候选**：', '');
    for (const c of candidates) lines.push(`- [${c.name}（AppID ${c.appid}）](${c.url})`);
    lines.push('');
  }
  lines.push(
    '请在此 issue 中补充：Steam 商店链接或 AppID；如果不是 Steam 游戏，请补充开发商 / 发行年份等信息。',
    '补充后由维护者导入，或移除并重新添加 `compatibility-report` 标签触发重新处理。',
  );
  return lines.join('\n');
}

main().catch((err) => {
  console.error(`✕ ingest-issue failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
