import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Project } from "../types";

type UseProjectPickerOptions = {
  onProjectSelected?: (project: Project) => void;
};

export function useProjectPicker(options?: UseProjectPickerOptions) {
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickProject() {
    setIsPicking(true);
    setError(null);

    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return null;

      const project = await invoke<Project>("select_project_path", {
        path: selected,
      });

      options?.onProjectSelected?.(project);
      return project;
    } catch (e) {
      setError("Projekt konnte nicht gewählt werden.");
      console.error("pickProject failed", e);
      return null;
    } finally {
      setIsPicking(false);
    }
  }

  return { pickProject, isPicking, error, clearError: () => setError(null) };
}
