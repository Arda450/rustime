import { FolderOpen } from "lucide-react";
import { AppIcon } from "./Icon";

type Props = {
  onPick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export function ProjectPickerButton({
  onPick,
  disabled,
  loading,
  label = "Projekt wählen",
}: Props) {
  return (
    <button type="button" onClick={onPick} disabled={disabled || loading}>
      <AppIcon icon={FolderOpen} size={16} />
      <span>{loading ? "Wird geöffnet..." : label}</span>
    </button>
  );
}
