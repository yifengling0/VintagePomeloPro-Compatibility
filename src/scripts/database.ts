import MiniSearch from 'minisearch';
import { STATUS_META } from '../lib/status';
import { RENDERER_META } from '../lib/filters';
import type { ClientGame, Renderer, Status } from '../lib/types';

const PER_PAGE_OPTIONS = [24, 48, 96];
const BASE_URL = import.meta.env.BASE_URL;

interface SearchDoc {
  slug: string;
  name: string;
  name_zh: string;
  aliases: string[];
  developer: string[];
  publisher: string[];
  genres: string[];
}

// Tokenizer that keeps CJK characters as individual terms so that Chinese
// queries like 古墓 can match a title 古墓丽影, while ASCII words stay whole.
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const parts = text
    .toLowerCase()
    .split(/[\s,.;:!?/\\_\-()\[\]{}"'“”<>@|+*^%$#]+/u);
  for (const part of parts) {
    if (!part) continue;
    const cjkRuns = part.match(/[\u3400-\u4dbf\u4e00-\u9fff]+/g);
    if (cjkRuns) {
      for (const run of cjkRuns) tokens.push(...run.split(''));
    }
    const ascii = part.replace(/[\u3400-\u4dbf\u4e00-\u9fff]+/g, '');
    if (ascii) tokens.push(ascii);
  }
  return tokens;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface State {
  q: string;
  status: string;
  renderer: string;
  genre: string;
  gpu: string;
  page: number;
  per: number;
}

export function initDatabase(): void {
  const dataEl = document.getElementById('vpp-data');
  const resultsEl = document.getElementById('vpp-results')!;
  const countEl = document.getElementById('vpp-count')!;
  const paginationEl = document.getElementById('vpp-pagination')!;
  const searchEl = document.getElementById('vpp-search') as HTMLInputElement | null;
  const statusEl = document.getElementById('vpp-status') as HTMLSelectElement | null;
  const rendererEl = document.getElementById('vpp-renderer') as HTMLSelectElement | null;
  const genreEl = document.getElementById('vpp-genre') as HTMLSelectElement | null;
  const gpuEl = document.getElementById('vpp-gpu') as HTMLSelectElement | null;
  const perEl = document.getElementById('vpp-per') as HTMLSelectElement | null;
  const resetEl = document.getElementById('vpp-reset') as HTMLButtonElement | null;

  if (!dataEl) return;

  let games: ClientGame[] = [];
  try {
    games = JSON.parse(dataEl.textContent || '[]') as ClientGame[];
  } catch {
    games = [];
  }

  const mini = new MiniSearch<SearchDoc>({
    fields: ['name', 'name_zh', 'aliases', 'developer', 'publisher', 'genres'],
    idField: 'slug',
    storeFields: ['slug'],
    tokenize,
    searchOptions: {
      boost: { name: 3, name_zh: 3, aliases: 2, developer: 1, publisher: 1 },
      combineWith: 'AND',
      prefix: true,
      fuzzy: 0.2,
    },
  });
  mini.addAll(
    games.map((g) => ({
      slug: g.slug,
      name: g.name,
      name_zh: g.name_zh ?? '',
      aliases: g.aliases,
      developer: g.developer,
      publisher: g.publisher,
      genres: g.genres,
    })),
  );

  const params = new URLSearchParams(window.location.search);
  let per = parseInt(params.get('per') ?? '24', 10);
  if (!PER_PAGE_OPTIONS.includes(per)) per = 24;

  let state: State = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    renderer: params.get('renderer') ?? '',
    genre: params.get('genre') ?? '',
    gpu: params.get('gpu') ?? '',
    page: Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1),
    per,
  };

  function setControls(): void {
    if (searchEl) searchEl.value = state.q;
    if (statusEl) statusEl.value = state.status;
    if (rendererEl) rendererEl.value = state.renderer;
    if (genreEl) genreEl.value = state.genre;
    if (gpuEl) gpuEl.value = state.gpu;
    if (perEl) perEl.value = String(state.per);
  }

  function matched(game: ClientGame): boolean {
    if (state.status && game.status !== state.status) return false;
    if (state.renderer && game.renderer !== state.renderer) return false;
    if (state.genre && !game.genres.some((g) => g === state.genre)) return false;
    if (state.gpu && game.gpu !== state.gpu) return false;
    return true;
  }

  function candidates(): ClientGame[] {
    const query = state.q.trim();
    if (!query) {
      return [...games].sort(
        (a, b) => b.updated_at.localeCompare(a.updated_at) || b.release_year - a.release_year,
      );
    }
    const search = mini.search(query);
    const order = new Map<string, number>();
    search.forEach((res, i) => order.set(String(res.id), i));
    return games
      .filter((g) => order.has(g.slug))
      .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  }

  function render(): void {
    const list = candidates().filter(matched);
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / state.per));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.per;
    const pageGames = list.slice(start, start + state.per);

    const activeFilters = Number(Boolean(state.status)) +
      Number(Boolean(state.renderer)) +
      Number(Boolean(state.genre)) +
      Number(Boolean(state.gpu));
    countEl.textContent = state.q || activeFilters
      ? `${total} 个结果`
      : `共 ${total} 款游戏`;

    resultsEl.innerHTML = pageGames
      .map(cardHTML)
      .join('');
    if (pageGames.length === 0) {
      resultsEl.innerHTML =
        '<p class="col-span-full rounded-xl border border-slate-700/60 bg-slate-800/40 p-8 text-center text-slate-400">没有找到匹配的游戏，换个关键词或清除筛选试试。</p>';
    }

    renderPagination(totalPages, total);
    syncUrl();
  }

  function renderPagination(totalPages: number, total: number): void {
    if (total <= state.per) {
      paginationEl.innerHTML = '';
      return;
    }
    const parts: string[] = [];
    const current = state.page;
    const pages: (number | '…')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - current) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }

    parts.push(pageButton('‹', current - 1, current <= 1));
    for (const p of pages) {
      if (p === '…') {
        parts.push('<span class="px-2 text-slate-500">…</span>');
      } else {
        parts.push(pageButton(String(p), p, p === current, true));
      }
    }
    parts.push(pageButton('›', current + 1, current >= totalPages));
    paginationEl.innerHTML = parts.join('');

    paginationEl.querySelectorAll<HTMLElement>('[data-page]').forEach((el) => {
      el.addEventListener('click', () => {
        state.page = parseInt(el.dataset.page ?? '1', 10);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function pageButton(label: string, target: number, disabled: boolean, active = false): string {
    const base = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm transition';
    if (disabled) {
      return `<span class="${base} cursor-not-allowed text-slate-600">${label}</span>`;
    }
    if (active) {
      return `<span class="${base} bg-brand-500/20 font-semibold text-brand-100 ring-1 ring-brand-500/40">${label}</span>`;
    }
    return `<button type="button" data-page="${target}" class="${base} text-slate-300 hover:bg-slate-800 hover:text-white">${label}</button>`;
  }

  function syncUrl(): void {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.status) p.set('status', state.status);
    if (state.renderer) p.set('renderer', state.renderer);
    if (state.genre) p.set('genre', state.genre);
    if (state.gpu) p.set('gpu', state.gpu);
    if (state.page > 1) p.set('page', String(state.page));
    if (state.per !== 24) p.set('per', String(state.per));
    const qs = p.toString();
    const basePath = window.location.pathname;
    const next = qs ? `${basePath}?${qs}` : basePath;
    window.history.replaceState(null, '', next);
  }

  function cardHTML(g: ClientGame): string {
    const meta = STATUS_META[g.status as Status] ?? STATUS_META.unknown;
    const rendererLabel = g.renderer
      ? `${RENDERER_META[g.renderer as Renderer]?.label ?? g.renderer}${g.renderer_version ? ` ${escapeHtml(g.renderer_version)}` : ''}`
      : '—';
    const href = `${BASE_URL}games/${g.slug}/`;
    const nameZh = g.name_zh ? `<p class="truncate text-sm text-slate-400">${escapeHtml(g.name_zh)}</p>` : '';
    const dev = g.developer.length ? ` · ${escapeHtml(g.developer.join(', '))}` : '';

    return `
      <article class="group relative flex flex-col rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5 transition hover:border-brand-500/40 hover:bg-slate-800">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold text-white group-hover:text-brand-100">
              <a href="${href}">${escapeHtml(g.name)}</a>
            </h3>
            ${nameZh}
          </div>
          <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${meta.badge}">
            <span class="h-1.5 w-1.5 rounded-full ${meta.dot}"></span>${meta.label}
          </span>
        </div>
        <p class="text-xs text-slate-400"><span>${g.release_year}</span>${dev}</p>
        <dl class="mt-auto space-y-1 pt-4 text-xs text-slate-300">
          <div class="flex gap-1.5"><dt class="shrink-0 text-slate-500">VP</dt><dd class="truncate">${g.winehua_version ? escapeHtml(g.winehua_version) : '—'} · ${rendererLabel}</dd></div>
          <div class="flex gap-1.5"><dt class="shrink-0 text-slate-500">设备</dt><dd class="truncate">${g.device_model ? escapeHtml(g.device_model) : '—'}${g.gpu ? ` · ${escapeHtml(g.gpu)}` : ''}</dd></div>
          <div class="flex gap-1.5"><dt class="shrink-0 text-slate-500">更新</dt><dd>${escapeHtml(g.updated_at)}</dd></div>
        </dl>
      </article>`;
  }

  function readStateFromControls(): void {
    state.q = searchEl?.value ?? '';
    state.status = statusEl?.value ?? '';
    state.renderer = rendererEl?.value ?? '';
    state.genre = genreEl?.value ?? '';
    state.gpu = gpuEl?.value ?? '';
    state.page = 1;
  }

  function reset(): void {
    state = { q: '', status: '', renderer: '', genre: '', gpu: '', page: 1, per: state.per };
    setControls();
    render();
  }

  searchEl?.addEventListener('input', () => {
    readStateFromControls();
    render();
  });
  statusEl?.addEventListener('change', () => {
    readStateFromControls();
    render();
  });
  rendererEl?.addEventListener('change', () => {
    readStateFromControls();
    render();
  });
  genreEl?.addEventListener('change', () => {
    readStateFromControls();
    render();
  });
  gpuEl?.addEventListener('change', () => {
    readStateFromControls();
    render();
  });
  perEl?.addEventListener('change', () => {
    state.per = parseInt(perEl.value, 10) || 24;
    state.page = 1;
    render();
  });
  resetEl?.addEventListener('click', reset);

  setControls();
  render();
}
