import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ToastViewport } from "./ToastViewport";

export type ToastTone = "success" | "error";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
  detail?: string;
};

type ShowToastOptions = {
  detail?: string;
  durationMs?: number;
};

type ToastContextValue = {
  success: (message: string, options?: ShowToastOptions) => void;
  error: (message: string, options?: ShowToastOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4200;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, options?: ShowToastOptions) => {
      const id = createId();
      const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
      setToasts((current) => [
        ...current,
        { id, tone, message, detail: options?.detail },
      ]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) =>
        push("error", message, {
          ...options,
          durationMs: options?.durationMs ?? 5600,
        }),
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast muss innerhalb von ToastProvider verwendet werden.");
  }
  return ctx;
}
