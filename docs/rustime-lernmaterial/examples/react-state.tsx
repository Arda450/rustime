/// <reference path="./jsx.d.ts" />
/// <reference path="./stubs.d.ts" />

/**
 * VEREINFACHT – React-State-Muster wie in App.tsx / OverviewPanel.tsx
 * Lernbeispiel (Typen via stubs.d.ts); echte App: tauri-app/
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Project = { id: number; name: string };

export function AppStateBeispiel() {
  // 1) UI-State: direkt in der Oberfläche sichtbar
  const [isTracking, setIsTracking] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // 2) Revision: „Daten neu laden“, ohne grosse Listen im State
  const [tableRevision, setTableRevision] = useState(0);

  // 3) Beim Start: Status vom Backend holen (Rust ist Quelle der Wahrheit)
  useEffect(() => {
    invoke<boolean>("is_tracking").then(setIsTracking);
    invoke<Project | null>("get_active_project").then(setActiveProject);
  }, []);

  async function startTracking() {
    await invoke("start_tracking");
    setIsTracking(true);
  }

  // 4) Wenn Backend ein neues Fenster meldet → Revision erhöhen
  function onNewActivityFromBackend() {
    setTableRevision((r) => r + 1);
  }

  return (
    <div>
      <p>Tracking: {isTracking ? "an" : "aus"}</p>
      <p>Projekt: {activeProject?.name ?? "keins"}</p>
      {/* ActivitiesTable refreshKey={tableRevision} */}
    </div>
  );
}
