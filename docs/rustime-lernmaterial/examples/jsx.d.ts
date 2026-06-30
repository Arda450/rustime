/** Globale JSX-Typen für Lernbeispiele (ohne @types/react). */

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>;
  }
}
