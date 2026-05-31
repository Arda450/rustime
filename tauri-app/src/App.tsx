import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Tabs } from "@base-ui/react/tabs";
import styles from "./components/AppTabs.module.css";
import OverviewPanel from "./components/OverviewPanel";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Activity, Project } from "./types";
import "./App.css";
import { ChartBar, Folder, Settings } from "lucide-react";
import { AppIcon } from "./components/Icon";

type AppStats = {
  activity_count: number;
  project_count: number;
};

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [tableRevision, setTableRevision] = useState(0);
  const [dwellRevision, setDwellRevision] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function refreshActivityCount() {
    invoke<AppStats>("get_app_stats")
      .then((stats) => setActivityCount(Number(stats.activity_count)))
      .catch((e) => console.error("get_app_stats failed", e));
  }

  useEffect(() => {
    invoke<boolean>("is_tracking")
      .then((running) => {
        setIsTracking(running);
        setStatusError(null);
      })
      .catch((e) => {
        console.error("is_tracking failed", e);
        setStatusError("Tracking-Status konnte nicht geladen werden.");
      });

    invoke<Project | null>("get_active_project")
      .then((project) => setActiveProject(project))
      .catch((e) => console.error("get_active_project failed", e));

    refreshActivityCount();
  }, []);

  function handleDataCleared() {
    setActiveProject(null);
    setIsTracking(false);
    setTableRevision((r) => r + 1);
    setDwellRevision((r) => r + 1);
    refreshActivityCount();
  }

  // Pie/Statistik periodisch aktualisieren, ohne bei jedem 2s-Sample die UI zu triggern
  useEffect(() => {
    if (!isTracking) return;

    const id = window.setInterval(() => {
      setDwellRevision((r) => r + 1);
      refreshActivityCount();
    }, 10_000); // 10 seconds

    return () => window.clearInterval(id);
  }, [isTracking]);

  useEffect(() => {
    let cancelled = false;

    const setupListener = async () => {
      const unlisten = await listen<Activity>("new-activity", () => {
        if (!cancelled) {
          setTableRevision((r) => r + 1);
          refreshActivityCount();
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
      setStatusError("Tracking konnte nicht gestartet werden.");
    }
  }

  async function handleStopTracking() {
    try {
      await invoke("stop_tracking");
      setIsTracking(false);
      setStatusError(null);
    } catch (e) {
      console.error("stop_tracking failed", e);
      setStatusError("Tracking konnte nicht gestoppt werden.");
    }
  }

  return (
    <main className={styles.Page}>
      <Tabs.Root className={styles.Tabs} defaultValue="overview">
        <img
          src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
          alt="Rustime"
          className="appLogo"
        />
        <Tabs.List className={styles.List}>
          <Tabs.Tab className={styles.Tab} value="overview">
            <AppIcon icon={ChartBar} size={16} aria-hidden />
            Übersicht
          </Tabs.Tab>
          <Tabs.Tab className={styles.Tab} value="projects">
            <AppIcon icon={Folder} size={16} aria-hidden />
            Projekte
          </Tabs.Tab>
          <Tabs.Tab className={styles.Tab} value="settings">
            <AppIcon icon={Settings} size={16} aria-hidden />
            Einstellungen
          </Tabs.Tab>
          <Tabs.Indicator className={styles.Indicator} />
        </Tabs.List>

        <Tabs.Panel className={styles.Panel} value="overview">
          <OverviewPanel
            isTracking={isTracking}
            onStartTracking={handleStartTracking}
            onStopTracking={handleStopTracking}
            statusError={statusError}
            activeProject={activeProject}
            activityCount={activityCount}
            tableRevision={tableRevision}
            dwellRevision={dwellRevision}
            onProjectSelected={setActiveProject}
          />
        </Tabs.Panel>

        <Tabs.Panel className={styles.Panel} value="projects">
          <ProjectsPanel
            activeProject={activeProject}
            onProjectSelected={setActiveProject}
          />
        </Tabs.Panel>

        <Tabs.Panel className={styles.Panel} value="settings">
          <SettingsPanel
            theme={theme}
            onThemeChange={setTheme}
            onDataCleared={handleDataCleared}
          />
        </Tabs.Panel>
      </Tabs.Root>
    </main>
  );
}
