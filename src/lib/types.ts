export type Status =
  | 'perfect'
  | 'playable'
  | 'minor_issues'
  | 'major_issues'
  | 'broken'
  | 'unknown';

export type Renderer =
  | 'virgl'
  | 'dxvk'
  | 'vkd3d'
  | 'wined3d'
  | 'native_opengl'
  | 'other';

export type Confidence = 'high' | 'medium' | 'low';

export type ReportSourceType = 'github_issue' | 'manual' | 'maintainer' | 'ci';

export interface ReportSource {
  type: ReportSourceType;
  issue?: number | null;
  user?: string | null;
  url?: string | null;
}

export interface ReportDevice {
  model?: string | null;
  soc?: string | null;
  gpu?: string | null;
  os?: string | null;
  os_version?: string | null;
}

export interface ReportRenderer {
  backend: Renderer;
  version?: string | null;
}

export interface ReportPerformance {
  fps_avg?: number | null;
  fps_min?: number | null;
  fps_max?: number | null;
  resolution?: string | null;
}

export interface ReportEvidence {
  screenshots?: string[];
  logs?: string[];
  videos?: string[];
}

export interface Report {
  report_id: string;
  source: ReportSource;
  tested_at: string;
  winehua_version?: string | null;
  device?: ReportDevice;
  renderer?: ReportRenderer;
  graphics_api?: { api?: string | null };
  architecture?: { game?: string | null; wine?: string | null };
  status: Status;
  performance?: ReportPerformance;
  symptoms?: string[];
  workarounds?: string[];
  notes?: string | null;
  evidence?: ReportEvidence;
}

export interface GameMetadataSource {
  type: string;
  id?: string | null;
  url?: string | null;
}

export interface Game {
  schema_version: number;
  id: string;
  slug: string;
  name: string;
  name_zh?: string | null;
  aliases?: string[];
  release_date: string;
  release_year: number;
  developer: string[];
  publisher?: string[];
  genres: string[];
  platforms: string[];
  external_ids?: { steam?: string | null; igdb?: string | null; gog?: string | null };
  metadata_sources?: GameMetadataSource[];
  metadata_confidence: Confidence;
  created_at: string;
  updated_at: string;
  reports: Report[];
}

/** Shape serialized into the page for the client-side database UI. */
export interface ClientGame {
  slug: string;
  name: string;
  name_zh: string | null;
  release_year: number;
  developer: string[];
  publisher: string[];
  genres: string[];
  status: Status;
  winehua_version: string | null;
  renderer: string | null;
  renderer_version: string | null;
  gpu: string | null;
  device_model: string | null;
  updated_at: string;
  aliases: string[];
}
