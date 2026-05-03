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
    <button onClick={onPick} disabled={disabled || loading}>
      {loading ? "Wird geöffnet..." : label}
    </button>
  );
}
