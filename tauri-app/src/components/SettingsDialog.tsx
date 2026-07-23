import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { AppIcon } from "./Icon";
import { SettingsPanel } from "./SettingsPanel";

type SettingsDialogProps = {
  open: boolean;
  theme: "dark" | "light";
  onOpenChange: (open: boolean) => void;
  onThemeChange: (theme: "dark" | "light") => void;
  onDataCleared: () => void;
};

export function SettingsDialog({
  open,
  theme,
  onOpenChange,
  onThemeChange,
  onDataCleared,
}: SettingsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Popup className="settingsDialogPopup">
          <header className="settingsDialogHeader">
            <Dialog.Title className="settingsDialogTitle">
              Einstellungen
            </Dialog.Title>
            <Dialog.Close
              className="settingsDialogClose"
              aria-label="Schliessen"
            >
              <AppIcon icon={X} size={18} aria-hidden />
            </Dialog.Close>
          </header>
          <div className="settingsDialogBody">
            <SettingsPanel
              theme={theme}
              onThemeChange={onThemeChange}
              onDataCleared={onDataCleared}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
