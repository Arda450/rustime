export type Project = {
  id: number;
  name: string;
  path: string;
};

export type Activity = {
  title: string;
  context_label: string;
  timestamp: number;
  project_id: number | null;
  project_name: string | null;
};

export type DwellSegment = {
  name: string;
  value: number;
};

export type ActivitiesPage = {
  items: Activity[];
  total_count: number;
};

export type CategoryTimeSeriesPoint = {
  ts: number;
  categories: { name: string; value: number }[];
};

/** Gemeinsame Felder von Tages- und Wochenbericht. */
export type ReportCore = {
  project_name: string | null;
  total_active_seconds: number;
  context_count: number;
  first_activity_ts: number | null;
  last_activity_ts: number | null;
  by_category: DwellSegment[];
  /** Zeit pro Tätigkeitsklasse (Entwicklung, Kommunikation, etc.). */
  by_activity_type: DwellSegment[];
  timeline: CategoryTimeSeriesPoint[];
};

export type DailyReport = ReportCore & {
  date: string;
  by_project_day: DwellSegment[];
};

export type WeeklyReport = ReportCore & {
  week_start: string;
  week_end: string;
  active_days: number;
  by_day: DwellSegment[];
  by_project_week: DwellSegment[];
};

/** Filterkontext für Export (entspricht Aktivitätstabelle). */
export type TableExportFilter = {
  projectId: number | null;
  fromTs: number | null;
  toTs: number | null;
  contextQuery: string | null;
};

export type ExportCsvResult = {
  samples_path: string;
  aggregated_path: string;
};
