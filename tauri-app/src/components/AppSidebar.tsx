import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckSquare2,
  ChartBar,
  CirclePause,
  CirclePlay,
  Pencil,
  Plus,
  Square,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { Project } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { AppIcon } from "./Icon";
import { colorForCategoryIndex } from "../utils/chartColors";
import styles from "./AppSidebar.module.css";

type AppSidebarProps = {
  theme: "dark" | "light";
  overviewOpen: boolean;
  settingsOpen: boolean;
  activeProject: Project | null;
  isTracking: boolean;
  projectsRevision: number;
  onOverviewOpenChange: (open: boolean) => void;
  onSettingsOpenChange: (open: boolean) => void;
  onProjectSelected: (project: Project) => void;
  onProjectDeleted?: (projectId: number) => void;
  onStartTracking: () => Promise<void> | void;
  onStopTracking: () => Promise<void> | void;
};

export function AppSidebar({
  theme,
  overviewOpen,
  settingsOpen,
  activeProject,
  isTracking,
  projectsRevision,
  onOverviewOpenChange,
  onSettingsOpenChange,
  onProjectSelected,
  onProjectDeleted,
  onStartTracking,
  onStopTracking,
}: AppSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(
    new Set(),
  );
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function loadProjects() {
    const rows = await invoke<Project[]>("get_projects");
    setProjects(rows);
  }

  useEffect(() => {
    loadProjects().catch((e) => console.error("get_projects failed", e));
  }, [projectsRevision]);

  async function activateAndTrack(projectId: number) {
    const project = await invoke<Project>("set_active_project", {
      projectId,
    });
    onProjectSelected(project);
    onSettingsOpenChange(false);
    await onStartTracking();
  }

  async function handleProjectClick(projectId: number) {
    if (isEditing) {
      toggleProjectSelection(projectId);
      return;
    }

    const isActive = activeProject?.id === projectId;

    try {
      if (isActive && isTracking) {
        await onStopTracking();
        return;
      }

      if (isActive && !isTracking) {
        await onStartTracking();
        return;
      }

      // Anderes Projekt: aktiv setzen; Tracking neu starten bzw. weiterlaufen lassen
      if (isTracking) {
        const project = await invoke<Project>("set_active_project", {
          projectId,
        });
        onProjectSelected(project);
        onSettingsOpenChange(false);
        return;
      }

      await activateAndTrack(projectId);
    } catch (e) {
      console.error("project tracking toggle failed", e);
    }
  }

  async function confirmDeleteProjects() {
    const projectIds = [...selectedProjectIds];
    if (projectIds.length === 0) return;
    setEditError(null);
    try {
      for (const projectId of projectIds) {
        await invoke("delete_project", { projectId });
        onProjectDeleted?.(projectId);
      }
      await loadProjects();
      setSelectedProjectIds(new Set());
      setIsEditing(false);
    } catch (e) {
      console.error("delete_project failed", e);
      setEditError(
        "Ausgewählte Projekte konnten nicht vollständig gelöscht werden.",
      );
    }
  }

  function toggleEditing() {
    if (isEditing) {
      setSelectedProjectIds(new Set());
      setEditError(null);
    }
    setIsEditing(!isEditing);
  }

  function toggleProjectSelection(projectId: number) {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  async function handleCreated(project: Project) {
    onProjectSelected(project);
    onSettingsOpenChange(false);
    await loadProjects().catch((e) => console.error("get_projects failed", e));
    try {
      await onStartTracking();
    } catch (e) {
      console.error("start_tracking after create failed", e);
    }
  }

  return (
    <aside className={styles.Sidebar} aria-label="Seitennavigation">
      <img
        src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
        alt="Rustime"
        className={styles.Logo}
      />

      <button
        type="button"
        className={[styles.NavItem, overviewOpen ? styles.NavItemActive : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          onSettingsOpenChange(false);
          onOverviewOpenChange(true);
        }}
      >
        <AppIcon icon={ChartBar} size={16} aria-hidden />
        App-Übersicht
      </button>

      <div className={styles.Divider} />

      <div className={styles.ProjectHeader}>
        <span>Projekte</span>
        {projects.length > 0 && (
          <button
            type="button"
            className={[
              styles.EditButton,
              isEditing ? styles.EditButtonActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={toggleEditing}
            aria-pressed={isEditing}
            aria-label={
              isEditing
                ? "Projektbearbeitung beenden"
                : "Projekte zum Löschen auswählen"
            }
            title={isEditing ? "Bearbeitung beenden" : "Projekte bearbeiten"}
          >
            <AppIcon icon={isEditing ? X : Pencil} size={15} aria-hidden />
          </button>
        )}
      </div>

      <div className={styles.ProjectList}>
        {projects.map((project, index) => {
          const isActive = activeProject?.id === project.id;
          const isTrackingThis = isActive && isTracking;
          const isSelected = selectedProjectIds.has(project.id);
          const accent = colorForCategoryIndex(index);

          return (
            <div
              key={project.id}
              className={[
                styles.ProjectRow,
                isActive ? styles.ProjectRowActive : "",
                isSelected ? styles.ProjectRowSelected : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className={styles.ProjectButton}
                onClick={() => handleProjectClick(project.id)}
                title={
                  isEditing
                    ? project.name
                    : isTrackingThis
                      ? `${project.name} – Tracking stoppen`
                      : `${project.name} – Tracking starten`
                }
                aria-current={isActive ? "true" : undefined}
                aria-pressed={isEditing ? isSelected : isTrackingThis}
              >
                {isEditing ? (
                  <span className={styles.SelectionIcon}>
                    <AppIcon
                      icon={isSelected ? CheckSquare2 : Square}
                      size={18}
                      aria-hidden
                    />
                  </span>
                ) : (
                  <span
                    className={styles.ProjectIcon}
                    style={
                      isTrackingThis
                        ? undefined
                        : { background: accent, borderColor: accent }
                    }
                  >
                    <AppIcon
                      icon={isTrackingThis ? CirclePause : CirclePlay}
                      size={22}
                      aria-hidden
                    />
                  </span>
                )}
                <span className={styles.ProjectName}>{project.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {isEditing && (
        <div className={styles.EditActions}>
          <button
            type="button"
            className={styles.CancelEditButton}
            onClick={toggleEditing}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.DeleteSelectedButton}
            disabled={selectedProjectIds.size === 0}
            onClick={() => setDeleteConfirmationOpen(true)}
          >
            <AppIcon icon={Trash2} size={14} aria-hidden />
            Löschen ({selectedProjectIds.size})
          </button>
        </div>
      )}

      {editError && <p className={styles.Error}>{editError}</p>}

      <button
        type="button"
        className={styles.NewProject}
        onClick={() => setCreateOpen(true)}
      >
        <AppIcon icon={Plus} size={16} aria-hidden />
        Neues Projekt
      </button>

      <div className={styles.Divider} />

      <button
        type="button"
        className={[styles.NavItem, settingsOpen ? styles.NavItemActive : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          onOverviewOpenChange(false);
          onSettingsOpenChange(true);
        }}
      >
        <AppIcon icon={Settings} size={16} aria-hidden />
        Einstellungen
      </button>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <ConfirmDialog
        open={deleteConfirmationOpen}
        title={
          selectedProjectIds.size === 1
            ? "Projekt löschen?"
            : `${selectedProjectIds.size} Projekte löschen?`
        }
        description={`Die ausgewählten Projekte und alle zugehörigen Aktivitäten werden unwiderruflich gelöscht.`}
        confirmLabel={`${selectedProjectIds.size} löschen`}
        cancelLabel="Abbrechen"
        onConfirm={confirmDeleteProjects}
        onOpenChange={setDeleteConfirmationOpen}
      />
    </aside>
  );
}
