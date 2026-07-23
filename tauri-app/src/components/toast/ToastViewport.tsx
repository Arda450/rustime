import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { AppIcon } from "../Icon";
import type { ToastItem } from "./ToastContext";

type Props = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastViewport({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toastViewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toastItem toastItem--${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <AppIcon
            icon={toast.tone === "success" ? CheckCircle2 : CircleAlert}
            size={18}
          />
          <div className="toastBody">
            <p className="toastMessage">{toast.message}</p>
            {toast.detail ? <p className="toastDetail">{toast.detail}</p> : null}
          </div>
          <button
            type="button"
            className="toastDismiss"
            aria-label="Meldung schliessen"
            onClick={() => onDismiss(toast.id)}
          >
            <AppIcon icon={X} size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
