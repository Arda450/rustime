type BackendApiError = {
  code?: string;
  message?: string;
  error?: string;
};

export function parseApiError(error: unknown): {
  code?: string;
  message: string;
} {
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error) as BackendApiError;
      if (parsed.message) return { code: parsed.code, message: parsed.message };
      if (parsed.error) return { code: parsed.code, message: parsed.error };
    } catch {
      return { message: error };
    }
    return { message: error };
  }

  if (error && typeof error === "object") {
    const parsed = error as BackendApiError;
    if (typeof parsed.message === "string") {
      return { code: parsed.code, message: parsed.message };
    }
    if (typeof parsed.error === "string") {
      return { code: parsed.code, message: parsed.error };
    }
  }

  return { message: "Unbekannter Fehler" };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const parsed = parseApiError(error);
  switch (parsed.code) {
    case "DB_LOCK_FAILED":
      return "Datenbank ist aktuell gesperrt. Bitte erneut versuchen.";
    case "DB_READ_FAILED":
    case "DB_SQL_FAILED":
      return "Daten konnten nicht gelesen werden.";
    case "DB_IO_FAILED":
      return "Dateizugriff fehlgeschlagen.";
    case "APP_DIR_NOT_FOUND":
      return "Dokumente-Ordner wurde nicht gefunden.";
    case "WINDOW_NOT_FOUND":
      return "Kein aktives Fenster erkannt.";
    case "WINDOW_TITLE_EMPTY":
      return "Fenstertitel war leer.";
    case "JSON_SERIALIZE_FAILED":
      return "Export konnte nicht erstellt werden.";
    default:
      return parsed.message || fallback;
  }
}
