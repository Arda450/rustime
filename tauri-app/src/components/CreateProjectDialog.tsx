import { useEffect, useId, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { invoke } from "@tauri-apps/api/core";
import { Project } from "../types";

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: Project) => void;
};

/**
 * Dialog zum Anlegen eines Projekts per Name (ohne File-Explorer).
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const nameId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
    setIsSaving(false);
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Bitte einen Projektnamen eingeben.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const project = await invoke<Project>("create_project", { name: trimmed });
      onCreated(project);
      onOpenChange(false);
    } catch (e) {
      console.error("create_project failed", e);
      setError("Projekt konnte nicht erstellt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="confirmDialogBackdrop" />
        <Dialog.Popup className="confirmDialogPopup createProjectDialog">
          <form className="createProjectForm" onSubmit={handleSubmit}>
            <div className="confirmDialogIntro">
              <Dialog.Title className="confirmDialogTitle">
                Neues Projekt
              </Dialog.Title>
              <Dialog.Description className="confirmDialogDescription">
                Gib einen Namen ein. Ein Ordner aus dem Explorer ist nicht
                nötig.
              </Dialog.Description>
            </div>

            <label className="createProjectLabel" htmlFor={nameId}>
              Projektname
              <input
                id={nameId}
                className="createProjectInput"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Mein Projekt"
                maxLength={120}
                autoFocus
                disabled={isSaving}
              />
            </label>

            {error && <p className="createProjectError">{error}</p>}

            <div className="confirmDialogActions">
              <Dialog.Close
                className="confirmDialogCancel"
                disabled={isSaving}
              >
                Abbrechen
              </Dialog.Close>
              <button type="submit" disabled={isSaving || !name.trim()}>
                {isSaving ? "Speichern…" : "Erstellen"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
