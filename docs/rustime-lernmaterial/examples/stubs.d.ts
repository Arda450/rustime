/**
 * Typ-Stubs nur für Lernbeispiele in diesem Ordner.
 * Echte Pakete liegen in tauri-app/node_modules.
 */

declare module "react" {
  export function useState<T>(
    initial: T | (() => T),
  ): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void;
}

declare module "react/jsx-runtime" {
  export function jsx(
    type: unknown,
    props: unknown,
    key?: string | number,
  ): unknown;
  export function jsxs(
    type: unknown,
    props: unknown,
    key?: string | number,
  ): unknown;
  export const Fragment: unique symbol;
}

declare module "@tauri-apps/api/core" {
  export function invoke<T>(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T>;
}

declare module "@tauri-apps/api/event" {
  export function listen<T>(
    event: string,
    handler: (event: { payload: T }) => void,
  ): Promise<() => void>;
}
