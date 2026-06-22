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

export type DailyReport = {
  date: string;
  project_name: string | null;
  total_active_seconds: number;
  sample_count: number;
  first_activity_ts: number | null;
  last_activity_ts: number | null;
  by_category: DwellSegment[];
  timeline: CategoryTimeSeriesPoint[];
  top_contexts: DwellSegment[];
};
