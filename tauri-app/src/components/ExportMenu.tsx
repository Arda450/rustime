import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download } from "lucide-react";
import { AppIcon } from "./Icon";
import styles from "./ExportMenu.module.css";

export type ExportMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

type Props = {
  label?: string;
  items: ExportMenuItem[];
  disabled?: boolean;
  busy?: boolean;
  /** Einziger Eintrag: Klick löst direkt aus, ohne Dropdown. */
  directAction?: boolean;
};

export function ExportMenu({
  label = "Export",
  items,
  disabled = false,
  busy = false,
  directAction = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const enabledItems = items.filter((item) => !item.disabled);
  const isDisabled = disabled || busy || enabledItems.length === 0;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (isDisabled) setOpen(false);
  }, [isDisabled]);

  function runDirect() {
    const only = enabledItems[0];
    if (only) only.onSelect();
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        disabled={isDisabled}
        aria-haspopup={directAction ? undefined : "menu"}
        aria-expanded={directAction ? undefined : open}
        aria-controls={directAction ? undefined : menuId}
        onClick={() => {
          if (directAction) {
            runDirect();
            return;
          }
          setOpen((value) => !value);
        }}
      >
        <AppIcon icon={Download} size={16} />
        <span>{busy ? "Export…" : label}</span>
        {!directAction && <AppIcon icon={ChevronDown} size={14} />}
      </button>

      {!directAction && open && (
        <div className={styles.menu} role="menu" id={menuId}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={item.disabled || busy}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
