import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Project } from "../types";
import { useProjectPicker } from "../hooks/useProjectPicker";
import { ProjectPickerButton } from "./ProjectPickerButton";

type ProjectsPanelProps = {
  activeProject: Project | null;
  onProjectSelected: (project: Project) => void;
};

export function ProjectsPanel({
  activeProject,
  onProjectSelected,
}: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [msg, setMsg] = useState("");

  async function loadProjects() {
    const rows = await invoke<Project[]>("get_projects");
    setProjects(rows);
  }

  const { pickProject, isPicking, error, clearError } = useProjectPicker({
    onProjectSelected,
  });

  async function chooseProject() {
    clearError();
    const project = await pickProject();
    if (!project) return;

    setMsg(`Aktives Projekt: ${project.name}`);
    await loadProjects();
  }

  async function setActiveProject(projectId: number) {
    try {
      const project = await invoke<Project>("set_active_project", {
        projectId,
      });
      onProjectSelected(project);
      setMsg(`Aktives Projekt: ${project.name}`);
      await loadProjects();
    } catch (e) {
      setMsg(`Projektwechsel fehlgeschlagen: ${String(e)}`);
    }
  }

  useEffect(() => {
    loadProjects().catch((e) => setMsg(String(e)));
  }, []);

  return (
    <section className="container">
      <h2>Projekte</h2>

      <ProjectPickerButton onPick={chooseProject} loading={isPicking} />

      <p>{msg}</p>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {activeProject && (
        <p>
          Aktiv: {activeProject.name} ({activeProject.path})
        </p>
      )}

      <ul>
        {projects.map((p) => {
          const isActive = activeProject?.id === p.id;

          return (
            <li key={p.id} className="projectRow">
              <span className="projectLabel">
                {p.name} - {p.path}{" "}
                {isActive ? <span className="greenDotActive"></span> : null}
              </span>

              <button
                className="projectActionBtn"
                onClick={() => setActiveProject(p.id)}
                disabled={isActive}
                aria-label={`Projekt ${p.name} aktiv setzen`}
              >
                {isActive ? "Aktiv" : "Aktiv setzen"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
