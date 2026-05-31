import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import type { ActivitiesPage, Activity } from "../types";

type ActivityRow = {
  id: string;
  context: string;
  date: string;
  time: string;
  project: string;
};

type Props = {
  projectId: number | null;
  refreshKey: number;
  pageSize?: number;
};

function toRows(items: Activity[]): ActivityRow[] {
  return items.map((a, index) => {
    const d = new Date(a.timestamp * 1000);
    return {
      id: `${a.timestamp}-${index}`,
      context: a.context_label,
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString(),
      project: a.project_name ?? "—",
    };
  });
}

export function ActivitiesTable({
  projectId,
  refreshKey,
  pageSize = 20,
}: Props) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [pageData, setPageData] = useState<ActivitiesPage>({
    items: [],
    total_count: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    invoke<ActivitiesPage>("get_activities_page", {
      projectId,
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
    })
      .then((result) => {
        if (!cancelled) setPageData(result);
      })
      .catch((e) => console.error("get_activities_page failed", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, pagination.pageIndex, pagination.pageSize, refreshKey]);

  const data = useMemo(() => toRows(pageData.items), [pageData.items]);

  const columns = useMemo<ColumnDef<ActivityRow>[]>(
    () => [
      { accessorKey: "context", header: "Kontext" },
      { accessorKey: "date", header: "Datum" },
      { accessorKey: "time", header: "Uhrzeit" },
      { accessorKey: "project", header: "Projekt" },
    ],
    [],
  );

  const pageCount = Math.max(
    1,
    Math.ceil(pageData.total_count / pagination.pageSize) || 1,
  );

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    autoResetPageIndex: false,
  });

  if (!loading && pageData.total_count === 0) {
    return (
      <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
        Noch keine Aktivitäten erfasst.
      </p>
    );
  }

  return (
    <div>
      {loading && (
        <p style={{ color: "var(--muted)", marginBottom: 8 }}>Lade Einträge…</p>
      )}
      <table className="activitiesTable">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <span className="pageInfo">
          Seite {pagination.pageIndex + 1} / {pageCount} ({pageData.total_count}{" "}
          Einträge)
        </span>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Zurück
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}
