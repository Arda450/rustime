import { AlertDialog } from "@base-ui/react/alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

/**
 * Wiederverwendbarer Bestätigungsdialog (z. B. vor dem Löschen).
 * Gesteuert über `open`/`onOpenChange`; bestätigt via `onConfirm`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Löschen",
  cancelLabel = "Abbrechen",
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="confirmDialogBackdrop" />
        <AlertDialog.Popup className="confirmDialogPopup">
          <div className="confirmDialogIntro">
            <AlertDialog.Title className="confirmDialogTitle">
              {title}
            </AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="confirmDialogDescription">
                {description}
              </AlertDialog.Description>
            )}
          </div>
          <div className="confirmDialogActions">
            <AlertDialog.Close className="confirmDialogCancel">
              {cancelLabel}
            </AlertDialog.Close>
            <button
              className="danger confirmDialogConfirm"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
