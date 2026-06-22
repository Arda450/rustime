import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import type { ActivitiesPage, Activity } from "../types";
import {
  dateInputToFromTs,
  dateInputToToTs,
  formatIsoDate,
} from "../utils/dateRange";

type ActivityRow = {
  id: string;
  context: string;
  date: string;
  time: string;
  project: string;
};

type Props = {
  projectId: number | null;
  projectName?: string | null;
  refreshKey: number;
  pageSize?: number;
  /** Setzt Von/Bis-Filter von aussen (z. B. aus Tagesbericht). */
  syncDateFilter?: { from: string; to: string } | null;
};

const SORT_COLUMN_LABELS: Record<string, string> = {
  context: "Kontext",
  date: "Datum",
  time: "Uhrzeit",
  project: "Projekt",
};

function describeSortDirection(columnId: string, desc: boolean): string {
  if (columnId === "date" || columnId === "time") {
    return desc ? "neueste zuerst" : "älteste zuerst";
  }
  return desc ? "Z–A" : "A–Z";
}

function describeSortState(sorting: SortingState): string {
  const active = sorting[0];
  if (!active) return "Sortierung: Datum, neueste zuerst";
  const label = SORT_COLUMN_LABELS[active.id] ?? active.id;
  const direction = describeSortDirection(active.id, active.desc);
  return `Sortierung: ${label}, ${direction}`;
}

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
  projectName = null,
  refreshKey,
  pageSize = 20,
  syncDateFilter = null,
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
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  // Filter-State (UI-Eingaben)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [contextQuery, setContextQuery] = useState("");
  // Debounced: erst nach kurzer Pause wird neu geladen (weniger DB-Queries beim Tippen)
  const [debouncedContext, setDebouncedContext] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedContext(contextQuery), 300);
    return () => clearTimeout(timer);
  }, [contextQuery]);

  useEffect(() => {
    if (syncDateFilter) {
      setDateFrom(syncDateFilter.from);
      setDateTo(syncDateFilter.to);
    }
  }, [syncDateFilter]);

  const hasActiveFilter =
    dateFrom !== "" || dateTo !== "" || debouncedContext.trim() !== "";

  // Bei Projekt- oder Filterwechsel zurück auf Seite 1
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [projectId, dateFrom, dateTo, debouncedContext]);

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  // Serverseitig laden: Filter + Sortierung + Paginierung gehen ans Backend
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fromTs = dateFrom ? dateInputToFromTs(dateFrom) : null;
    const toTs = dateTo ? dateInputToToTs(dateTo) : null;
    const query = debouncedContext.trim() || null;

    invoke<ActivitiesPage>("get_activities_page", {
      projectId,
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      fromTs,
      toTs,
      contextQuery: query,
      sortBy: sorting[0]?.id ?? "date",
      sortOrder: sorting[0]?.desc ? "desc" : "asc",
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
  }, [
    projectId,
    pagination.pageIndex,
    pagination.pageSize,
    refreshKey,
    dateFrom,
    dateTo,
    debouncedContext,
    sorting,
  ]);

  const data = useMemo(() => toRows(pageData.items), [pageData.items]);

  const sortStatusText = useMemo(() => describeSortState(sorting), [sorting]);

  const filterStatusItems = useMemo(() => {
    const items: { label: string; value: string }[] = [
      {
        label: "Von",
        value: dateFrom ? `ab ${formatIsoDate(dateFrom)}` : "kein Startdatum",
      },
      {
        label: "Bis",
        value: dateTo ? `bis ${formatIsoDate(dateTo)}` : "kein Enddatum",
      },
      {
        label: "Kontext",
        value: debouncedContext.trim()
          ? `enthält «${debouncedContext.trim()}»`
          : "alle Fenstertitel",
      },
      {
        label: "Projekt",
        value:
          projectId != null
            ? projectName
              ? `«${projectName}»`
              : "nur aktives Projekt"
            : "alle Projekte",
      },
    ];
    return items;
  }, [dateFrom, dateTo, debouncedContext, projectId, projectName]);

  const columns = useMemo<ColumnDef<ActivityRow>[]>(
    () => [
      {
        id: "context",
        accessorKey: "context",
        header: "Kontext",
        enableSorting: true,
      },
      { id: "date", accessorKey: "date", header: "Datum", enableSorting: true },
      {
        id: "time",
        accessorKey: "time",
        header: "Uhrzeit",
        enableSorting: true,
      },
      {
        id: "project",
        accessorKey: "project",
        header: "Projekt",
        enableSorting: true,
      },
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
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: handleSortingChange,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    autoResetPageIndex: false,
  });

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setContextQuery("");
  }

  const filterBar = (
    <div className="activitiesFilterSection">
      <p className="activitiesFilterIntro">
        <span>
          Filter und Sortierung gelten für alle Einträge in der Datenbank.
        </span>
        <span>Spaltenköpfe anklicken zum Sortieren.</span>
      </p>
      <p className="activitiesFilterStatus" aria-live="polite">
        <span className="activitiesFilterStatusItem activitiesFilterStatusSort">
          {sortStatusText}
        </span>
        {filterStatusItems.map((item) => (
          <span key={item.label} className="activitiesFilterStatusItem">
            <span className="activitiesFilterStatusLabel">{item.label}:</span>{" "}
            {item.value}
          </span>
        ))}
      </p>
      <div className="activitiesFilterBar">
        <label className="activitiesFilterField">
          <span className="activitiesFilterLabel">Von</span>
          <span className="activitiesFilterHint">Einträge ab diesem Tag</span>
          <input
            type="date"
            className="activitiesFilterDate"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="activitiesFilterField">
          <span className="activitiesFilterLabel">Bis</span>
          <span className="activitiesFilterHint">
            Einträge bis einschliesslich
          </span>
          <input
            type="date"
            className="activitiesFilterDate"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <label className="activitiesFilterField activitiesFilterFieldGrow">
          <span className="activitiesFilterLabel">Kontext</span>
          <span className="activitiesFilterHint">Suche im Fenstertitel</span>
          <input
            type="search"
            placeholder="Fenstertitel suchen…"
            value={contextQuery}
            onChange={(e) => setContextQuery(e.target.value)}
          />
        </label>
        {hasActiveFilter && (
          <button
            type="button"
            className="activitiesFilterReset"
            onClick={clearFilters}
          >
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );

  if (!loading && pageData.total_count === 0) {
    return (
      <div>
        {filterBar}
        <p className="activitiesEmptyMessage">
          {hasActiveFilter
            ? "Keine Einträge für die gewählten Filter."
            : "Noch keine Aktivitäten erfasst."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {filterBar}

      {loading && (
        <p style={{ color: "var(--muted)", marginBottom: 8 }}>Lade Einträge…</p>
      )}
      <div className="activitiesTableWrap">
        <table className="activitiesTable">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const sortClass = sorted
                    ? sorted === "asc"
                      ? "activitiesTableSortedAsc"
                      : "activitiesTableSortedDesc"
                    : undefined;
                  return (
                    <th
                      key={h.id}
                      className={
                        h.column.getCanSort()
                          ? ["activitiesTableSortable", sortClass]
                              .filter(Boolean)
                              .join(" ")
                          : undefined
                      }
                      onClick={h.column.getToggleSortingHandler()}
                      title={
                        sorted
                          ? `${SORT_COLUMN_LABELS[h.column.id] ?? h.column.id}, ${describeSortDirection(h.column.id, sorted === "desc")}`
                          : undefined
                      }
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
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
      </div>

      <div>
        <span className="pageInfo">
          Seite {pagination.pageIndex + 1} / {pageCount} ({pageData.total_count}{" "}
          Einträge{hasActiveFilter ? ", gefiltert" : ""})
        </span>
        <div className="activitiesPagination">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Zurück
          </button>
          <button
            type="button"
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
