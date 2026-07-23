import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import styles from "./components/AppShell.module.css";
import OverviewPanel from "./components/OverviewPanel";
import { AppOverviewDialog } from "./components/AppOverviewDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { AppSidebar } from "./components/AppSidebar";
import { Activity, Project } from "./types";
import { ToastProvider } from "./components/toast/ToastContext";
import { apiErrorMessage } from "./utils/apiError";
import "./App.css";

type DataRevisions = {
  activities: number;
  statistics: number;
  projects: number;
};

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [revisions, setRevisions] = useState<DataRevisions>({
    activities: 0,
    statistics: 0,
    projects: 0,
  });
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    invoke<boolean>("is_tracking")
      .then((running) => {
        setIsTracking(running);
        setStatusError(null);
      })
      .catch((e) => {
        console.error("is_tracking failed", e);
        setStatusError(
          apiErrorMessage(e, "Tracking-Status konnte nicht geladen werden."),
        );
      });

    invoke<Project | null>("get_active_project")
      .then((project) => setActiveProject(project))
      .catch((e) => {
        console.error("get_active_project failed", e);
        setStatusError(
          apiErrorMessage(e, "Aktives Projekt konnte nicht geladen werden."),
        );
      });
  }, []);

  function refresh(...keys: (keyof DataRevisions)[]) {
    setRevisions((current) => {
      const next = { ...current };
      for (const key of keys) next[key] += 1;
      return next;
    });
  }

  function handleDataCleared() {
    setActiveProject(null);
    setIsTracking(false);
    refresh("activities", "statistics", "projects");
  }

  function handleProjectDeleted(projectId: number) {
    if (activeProject?.id === projectId) {
      setActiveProject(null);
      setIsTracking(false);
    }
    refresh("activities", "statistics", "projects");
  }

  useEffect(() => {
    let cancelled = false;

    const setupListener = async () => {
      const unlisten = await listen<Activity>("new-activity", () => {
        if (!cancelled) {
          refresh("activities", "statistics");
        }
      });

      if (cancelled) {
        unlisten();
      }

      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      cancelled = true;
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  async function handleStartTracking() {
    try {
      await invoke("start_tracking");
      setIsTracking(true);
      setStatusError(null);
    } catch (e) {
      console.error("start_tracking failed", e);
      setStatusError(
        apiErrorMessage(e, "Tracking konnte nicht gestartet werden."),
      );
    }
  }

  async function handleStopTracking() {
    try {
      await invoke("stop_tracking");
      setIsTracking(false);
      setStatusError(null);
    } catch (e) {
      console.error("stop_tracking failed", e);
      setStatusError(
        apiErrorMessage(e, "Tracking konnte nicht gestoppt werden."),
      );
    }
  }

  function handleProjectSelected(project: Project) {
    setActiveProject(project);
    refresh("projects", "statistics");
  }

  return (
    <ToastProvider>
      <main className={styles.Page}>
        <AppSidebar
          theme={theme}
          overviewOpen={overviewOpen}
          settingsOpen={settingsOpen}
          activeProject={activeProject}
          isTracking={isTracking}
          projectsRevision={revisions.projects}
          onOverviewOpenChange={setOverviewOpen}
          onSettingsOpenChange={setSettingsOpen}
          onProjectSelected={handleProjectSelected}
          onProjectDeleted={handleProjectDeleted}
          onStartTracking={handleStartTracking}
          onStopTracking={handleStopTracking}
        />

        <section className={styles.Main}>
          <OverviewPanel
            isTracking={isTracking}
            statusError={statusError}
            activeProject={activeProject}
            tableRevision={revisions.activities}
            dwellRevision={revisions.statistics}
          />
        </section>

        <SettingsDialog
          open={settingsOpen}
          theme={theme}
          onOpenChange={setSettingsOpen}
          onThemeChange={setTheme}
          onDataCleared={handleDataCleared}
        />

        <AppOverviewDialog
          open={overviewOpen}
          dwellRevision={revisions.statistics}
          onOpenChange={setOverviewOpen}
        />
      </main>
    </ToastProvider>
  );
}
