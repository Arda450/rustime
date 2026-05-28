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
