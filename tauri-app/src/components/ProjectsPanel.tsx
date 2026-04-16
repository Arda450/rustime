import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

type Project = { id: number; name: string; path: string };

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [msg, setMsg] = useState("");

  async function loadProjects() {
    const rows = await invoke<Project[]>("get_projects");
    setProjects(rows);
  }

  async function chooseProject() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;

    const project = await invoke<Project>("select_project_path", {
      path: selected,
    });
    setActive(project);
    setMsg(`Aktives Projekt: ${project.name}`);
    await loadProjects();
  }

  useEffect(() => {
    loadProjects().catch((e) => setMsg(String(e)));
  }, []);

  return (
    <section>
      <h2>Projects</h2>
      <button onClick={chooseProject}>Projekt wählen</button>
      <p>{msg}</p>
      {active && (
        <p>
          Aktiv: {active.name} ({active.path})
        </p>
      )}
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            {p.name} - {p.path}
          </li>
        ))}
      </ul>
    </section>
  );
}
