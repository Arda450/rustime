import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { CategoryTimeSeriesPoint } from "../types";
import type { PieSegment } from "../components/charts/PieChart";
import { mergeCategoryOrder } from "../utils/chartLegend";
import { apiErrorMessage } from "../utils/apiError";

const VISIBLE_HOURS = 24;
export const PROJECT_CHART_BUCKET_SECONDS = 15 * 60;
export const PROJECT_CHART_OPTIONS = {
  maxSegmentGapSeconds: 120,
  tailSeconds: 60,
  topN: 10,
} as const;

export function useProjectCharts(
  projectId: number | null,
  revision: number,
  enabled: boolean,
) {
  const [segments, setSegments] = useState<PieSegment[]>([]);
  const [timeline, setTimeline] = useState<CategoryTimeSeriesPoint[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loadedProjectId = useRef<number | null>(null);

  useEffect(() => {
    if (projectId == null) {
      setSegments([]);
      setTimeline([]);
      setCategoryOrder([]);
      setLoaded(false);
      loadedProjectId.current = null;
      return;
    }
    if (!enabled) return;

    let cancelled = false;
    const sameProject = loadedProjectId.current === projectId;
    if (sameProject && loaded) {
      setRefreshing(true);
    } else {
      setLoaded(false);
      setSegments([]);
      setTimeline([]);
      setCategoryOrder([]);
    }
    setError("");

    const toTs = Math.floor(Date.now() / 1000);
    const fromTs = toTs - VISIBLE_HOURS * 60 * 60;
    Promise.all([
      invoke<PieSegment[]>("get_dwell_by_category", {
        projectId,
        fromTs,
        toTs,
        ...PROJECT_CHART_OPTIONS,
      }),
      invoke<CategoryTimeSeriesPoint[]>("get_time_series_by_category", {
        projectId,
        fromTs,
        toTs,
        bucketSeconds: PROJECT_CHART_BUCKET_SECONDS,
        maxSegmentGapSeconds: PROJECT_CHART_OPTIONS.maxSegmentGapSeconds,
        tailSeconds: PROJECT_CHART_OPTIONS.tailSeconds,
      }),
    ])
      .then(([nextSegments, nextTimeline]) => {
        if (cancelled) return;
        setSegments(nextSegments);
        setTimeline(nextTimeline);
        setCategoryOrder(
          mergeCategoryOrder(
            nextSegments.map((segment) => segment.name),
            nextSegments,
            nextTimeline,
          ),
        );
        loadedProjectId.current = projectId;
        setLoaded(true);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            apiErrorMessage(
              reason,
              "Projektdaten konnten nicht geladen werden.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // `loaded` dient nur zur Wahl zwischen Erstladen und leisem Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId, revision]);

  return {
    segments,
    timeline,
    categoryOrder,
    loaded,
    refreshing,
    error,
  };
}
