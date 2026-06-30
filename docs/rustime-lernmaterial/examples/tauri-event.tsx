/// <reference path="./jsx.d.ts" />
/// <reference path="./stubs.d.ts" />

/**
 * VEREINFACHT – Event-Muster: Rust push, React listen
 * Echt: tracking.rs emit + App.tsx listen
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

type ActivityDto = {
  title: string;
  timestamp: number;
};

export function EventBeispiel() {
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const unlisten = await listen<ActivityDto>("new-activity", (event) => {
        if (cancelled) return;
        console.log("Neues Fenster:", event.payload.title);
        // In Rustime: tableRevision++ statt jede Activity in useState[]
      });

      return unlisten;
    };

    const unlistenPromise = setup();

    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  return null;
}

// Rust-Seite (Idee):
// app_handle.emit("new-activity", dto)?;
