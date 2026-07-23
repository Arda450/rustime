import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { AppIcon } from "./Icon";

type PanelDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

/**
 * Grosses Overlay-Panel (z. B. Projekte, Einstellungen).
 * Schliessen per Backdrop-Klick, Escape oder Close-Button.
 */
export function PanelDialog({
  open,
  title,
  children,
  onOpenChange,
}: PanelDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="panelDialogBackdrop" />
        <Dialog.Popup className="panelDialogPopup">
          <div className="panelDialogHeader">
            <Dialog.Title className="panelDialogTitle">{title}</Dialog.Title>
            <Dialog.Close className="panelDialogClose" aria-label="Schliessen">
              <AppIcon icon={X} size={18} aria-hidden />
            </Dialog.Close>
          </div>
          <div className="panelDialogBody">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
