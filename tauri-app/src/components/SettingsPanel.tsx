import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppIcon } from "./Icon";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./toast/ToastContext";
import { Database, Moon, Sun } from "lucide-react";

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
  const toast = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [pendingClear, setPendingClear] = useState<"activities" | "all" | null>(
    null,
  );

  async function handleClearActivities() {
    setIsClearing(true);
    try {
      const count = await invoke<number>("clear_all_activities");
      toast.success(
        count === 1
          ? "1 Aktivität gelöscht"
          : `${count} Aktivitäten gelöscht`,
      );
      onDataCleared();
    } catch (e) {
      toast.error("Aktivitäten konnten nicht gelöscht werden.");
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  }

  async function handleClearAll() {
    setIsClearing(true);
    try {
      await invoke<number>("clear_all_projects");
      toast.success("Alle Daten gelöscht");
      onDataCleared();
    } catch (e) {
      toast.error("Daten konnten nicht gelöscht werden.");
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
          <button
            type="button"
            className={`toggleSwitch ${theme === "dark" ? "active" : ""}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Dunkles Erscheinungsbild umschalten"
          />
        </div>
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
              onClick={() => setPendingClear("activities")}
              disabled={isClearing}
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
              onClick={() => setPendingClear("all")}
              disabled={isClearing}
            >
              Alles löschen
            </button>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="appInfo">
        <strong>Rustime {new Date().getFullYear()}</strong>
        <br />
        Lokales Activity-Tracking für Windows
      </div>

      <ConfirmDialog
        open={pendingClear !== null}
        title={
          pendingClear === "all"
            ? "Alle Daten löschen?"
            : "Alle Aktivitäten löschen?"
        }
        description={
          pendingClear === "all"
            ? "Projekte und Aktivitäten werden unwiderruflich gelöscht."
            : "Alle erfassten Fenster-Aktivitäten werden unwiderruflich gelöscht."
        }
        confirmLabel={isClearing ? "Wird gelöscht…" : "Endgültig löschen"}
        onOpenChange={(open) => {
          if (!open) setPendingClear(null);
        }}
        onConfirm={() => {
          if (pendingClear === "all") {
            void handleClearAll();
          } else if (pendingClear === "activities") {
            void handleClearActivities();
          }
        }}
      />
    </section>
  );
}
