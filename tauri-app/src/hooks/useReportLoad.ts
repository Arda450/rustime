import { useEffect, useRef, useState } from "react";

type UseReportLoadOptions<T> = {
  queryKey: string;
  load: () => Promise<T>;
  deps: readonly unknown[];
  loadErrorMessage: string;
};

export function useReportLoad<T>({
  queryKey,
  load,
  deps,
  loadErrorMessage,
}: UseReportLoadOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryKeyRef = useRef<string | null>(null);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    let cancelled = false;

    const isBackgroundRefresh =
      queryKeyRef.current === queryKey && dataRef.current != null;
    queryKeyRef.current = queryKey;

    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }

    load()
      .then((result) => {
        if (!cancelled) {
          dataRef.current = result;
          setData(result);
        }
      })
      .catch((e) => {
        console.error(loadErrorMessage, e);
        if (!cancelled) {
          if (!isBackgroundRefresh) {
            dataRef.current = null;
            setData(null);
          }
          setError(loadErrorMessage);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey kapselt deps
  }, [queryKey, loadErrorMessage, ...deps]);

  return { data, loading, isRefreshing, error };
}
