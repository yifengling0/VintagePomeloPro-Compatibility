import type { Game, Renderer, Status } from './types';
import { latestReport } from './status';

export const RENDERER_ORDER: Renderer[] = [
  'dxvk',
  'vkd3d',
  'wined3d',
  'virgl',
  'native_opengl',
  'other',
];

export const RENDERER_META: Record<Renderer, { label: string; zh: string }> = {
  dxvk: { label: 'DXVK', zh: 'DXVK' },
  vkd3d: { label: 'VKD3D', zh: 'VKD3D' },
  wined3d: { label: 'WineD3D', zh: 'WineD3D' },
  virgl: { label: 'VirGL', zh: 'VirGL' },
  native_opengl: { label: 'Native OpenGL', zh: '原生 OpenGL' },
  other: { label: 'Other', zh: '其他' },
};

export const GENRE_LABELS: Record<string, string> = {
  action: '动作',
  rpg: 'RPG',
  adventure: '冒险',
  fps: 'FPS',
  shooter: '射击',
  strategy: '策略',
  simulation: '模拟',
  visual_novel: '视觉小说',
  puzzle: '解谜',
  racing: '竞速',
  sports: '体育',
  fighting: '格斗',
  platformer: '平台跳跃',
  survival: '生存',
  benchmark: '基准测试',
  other: '其他',
};

export function rendererLabel(r: Renderer): string {
  return RENDERER_META[r]?.label ?? r;
}

export function rendererZh(r: Renderer): string {
  return RENDERER_META[r]?.zh ?? r;
}

export function genreLabel(g: string): string {
  return GENRE_LABELS[g.toLowerCase()] ?? g;
}

export function distinctGenres(games: Game[]): string[] {
  const seen = new Set<string>();
  for (const g of games) {
    for (const genre of g.genres) seen.add(genre.toLowerCase());
  }
  return [...seen];
}

export function distinctGpus(games: Game[]): string[] {
  const seen = new Set<string>();
  for (const g of games) {
    for (const r of g.reports) {
      const gpu = r.device?.gpu;
      if (gpu) seen.add(gpu);
    }
  }
  return [...seen].sort();
}

export interface Summary {
  status: Status;
  winehua_version: string | null;
  renderer: Renderer | null;
  renderer_version: string | null;
  gpu: string | null;
  device_model: string | null;
  tested_at: string;
}

export function summarize(g: Game): Summary {
  const rep = latestReport(g);
  return {
    status: rep.status,
    winehua_version: rep.winehua_version ?? null,
    renderer: rep.renderer?.backend ?? null,
    renderer_version: rep.renderer?.version ?? null,
    gpu: rep.device?.gpu ?? null,
    device_model: rep.device?.model ?? null,
    tested_at: rep.tested_at,
  };
}
