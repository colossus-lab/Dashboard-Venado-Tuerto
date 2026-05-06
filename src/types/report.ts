// ═══════════════════════════════════════════════════════════════
// Schema unificado para los informes del Dashboard Venado Tuerto
// ═══════════════════════════════════════════════════════════════

export type CategorySlug =
  | 'gobierno'
  | 'hacienda-economia'
  | 'educacion'
  | 'salud-desarrollo-humano'
  | 'seguridad-convivencia'
  | 'obras-servicios'
  | 'ambiente'
  | 'vivienda-territorio';

export interface CategoryDef {
  slug: CategorySlug;
  label: string;
  color: string;
  description: string;
}

export interface ReportMeta {
  id: string;
  title: string;
  category: CategorySlug;
  description: string;
  source: string; // URL CKAN
  license: string;
  last_updated: string;
  organization: string;
}

export interface KPI {
  id: string;
  label: string;
  value: number;
  formatted: string;
  unit?: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  hint?: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'stackedBar' | 'horizontalBar';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  subtitle?: string;
  data: Array<Record<string, any>>;
  config?: {
    keys?: string[];
    indexBy?: string;
    xAxis?: string;
    yAxis?: string;
    colors?: string[];
    valueFormat?: 'number' | 'currency' | 'percent';
  };
}

export interface ReportTable {
  id: string;
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  maxRows?: number;
}

export interface ReportData {
  meta: ReportMeta;
  kpis: KPI[];
  charts: ChartConfig[];
  tables?: ReportTable[];
}

export interface ReportEntry {
  id: string;
  slug: string; // ej: 'gobierno/personal-municipal'
  title: string;
  shortTitle: string;
  category: CategorySlug;
  color: string;
  mdPath: string; // /reports/...md
  dataPath: string; // /data/...json
  order: number;
}
