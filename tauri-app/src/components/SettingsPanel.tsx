import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppIcon } from "./Icon";
import { BarChart, Database, Moon, Sun } from "lucide-react";

type AppStats = {
  activity_count: number;
  project_count: number;
};

type SettingsPanelProps = {
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  onDataCleared: () => void;
};

export function SettingsPanel({
  theme,
  onThemeChange,
  onDataCleared,
}: SettingsPanelProps) {
  const [stats, setStats] = useState<AppStats | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadStats() {
    try {
      const data = await invoke<AppStats>("get_app_stats");
      setStats(data);
    } catch (e) {
      console.error("get_app_stats failed", e);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function handleClearActivities() {
    if (!confirm("Alle Aktivitäten unwiderruflich löschen?")) return;

    setIsClearing(true);
    try {
      const count = await invoke<number>("clear_all_activities");
      setMessage(`${count} Aktivitäten gelöscht.`);
      await loadStats();
      onDataCleared();
    } catch (e) {
      setMessage("Fehler beim Löschen.");
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  }

  async function handleClearAll() {
    if (
      !confirm("ALLE Daten (Projekte und Aktivitäten) unwiderruflich löschen?")
    )
      return;

    setIsClearing(true);
    try {
      await invoke<number>("clear_all_projects");
      setMessage("Alle Daten gelöscht.");
      await loadStats();
      onDataCleared();
    } catch (e) {
      setMessage("Fehler beim Löschen.");
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  }

  function toggleTheme() {
    onThemeChange(theme === "dark" ? "light" : "dark");
  }

  return (
    <section className="container">
      {/* Erscheinungsbild */}
      <div className="settingsSection">
        <div className="settingRow">
          <div className="settingLabel">
            <h4 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* if else für die Icons */}
              {theme === "dark" ? (
                <AppIcon icon={Moon} size={16} aria-hidden />
              ) : (
                <AppIcon icon={Sun} size={16} aria-hidden />
              )}
              {/* if else für den Text */}
              {theme === "dark" ? "Dark" : "Light"} Mode
            </h4>
          </div>
          <div
            className={`toggleSwitch ${theme === "dark" ? "active" : ""}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === "dark"}
          />
        </div>
      </div>

      {/* Statistiken */}
      <div className="settingsSection">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AppIcon icon={BarChart} size={16} aria-hidden />
          Statistiken
        </h3>
        {stats ? (
          <div className="statsGrid">
            <div className="statCard">
              <div className="value">{stats.activity_count}</div>
              <div className="label">
                {stats.activity_count === 1 ? "Aktivität" : "Aktivitäten"}
              </div>
            </div>
            <div className="statCard">
              <div className="value">{stats.project_count}</div>
              <div className="label">
                {stats.project_count === 1 ? "Projekt" : "Projekte"}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--muted)" }}>Lade Statistiken...</p>
        )}
      </div>

      {/* Datenverwaltung */}
      <div className="settingsSection">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AppIcon icon={Database} size={16} aria-hidden />
          Datenverwaltung
        </h3>
        <div className="settingRow">
          <div className="settingLabel">
            <span>Aktivitäten löschen</span>
            <span>Entfernt alle erfassten Fenster-Aktivitäten</span>
          </div>
          <div className="settingControl">
            <button
              className="danger"
              onClick={handleClearActivities}
              disabled={isClearing || !stats?.activity_count}
            >
              Löschen
            </button>
          </div>
        </div>
        <div className="settingRow">
          <div className="settingLabel">
            <span>Alle Daten löschen</span>
            <span>Entfernt Projekte und Aktivitäten</span>
          </div>
          <div className="settingControl">
            <button
              className="danger"
              onClick={handleClearAll}
              disabled={
                isClearing || (!stats?.activity_count && !stats?.project_count)
              }
            >
              Alles löschen
            </button>
          </div>
        </div>
        {message && (
          <p style={{ marginTop: 12, color: "var(--accent)" }}>{message}</p>
        )}
      </div>

      {/* App Info */}
      <div className="appInfo">
        <strong>Rustime {new Date().getFullYear()}</strong>
        <br />
        Lokales Activity-Tracking für Windows
      </div>
    </section>
  );
}
