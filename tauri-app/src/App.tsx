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

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

  // Theme auf document.documentElement setzen
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Beim App-Start: Tracking-Status, aktives Projekt und Aktivitäten laden
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

    loadActivities();
  }, []);

  function loadActivities() {
    invoke<Activity[]>("get_activities")
      .then((rows) => setActivities(rows))
      .catch((e) => console.error("get_activities failed", e));
  }

  function handleDataCleared() {
    loadActivities();
    setActiveProject(null);
  }

  // Event-Listener für neue Aktivitäten
  useEffect(() => {
    let cancelled = false;

    const setupListener = async () => {
      const unlisten = await listen<Activity>("new-activity", (event) => {
        if (!cancelled) {
          setActivities((prev) => [event.payload, ...prev]);
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
        {/* tabsliste */}
        <Tabs.List className={styles.List}>
          <Tabs.Tab className={styles.Tab} value="overview">
            Übersicht
          </Tabs.Tab>
          <Tabs.Tab className={styles.Tab} value="projects">
            Projekte
          </Tabs.Tab>
          <Tabs.Tab className={styles.Tab} value="settings">
            Einstellungen
          </Tabs.Tab>
          <Tabs.Indicator className={styles.Indicator} />
        </Tabs.List>

        {/* einzelne inhalte der tabsliste */}
        <Tabs.Panel className={styles.Panel} value="overview">
          <OverviewPanel
            isTracking={isTracking}
            onStartTracking={handleStartTracking}
            onStopTracking={handleStopTracking}
            statusError={statusError}
            activeProject={activeProject}
            activities={activities}
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
