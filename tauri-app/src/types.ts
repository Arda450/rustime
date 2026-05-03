export type Project = {
  id: number;
  name: string;
  path: string;
};

export type Activity = {
  title: string;
  timestamp: number;
  project_id: number | null;
  project_name: string | null;
};
