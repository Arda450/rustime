import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { listen } from "@tauri-apps/api/event";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [windowTitle, setWindowTitle] = useState("");
  const [isTracking, setIsTracking] = useState(false); // zeigt ob tracking läuft oder nicht
  const [activities, setActivities] = useState<
    { title: String; timestamp: number }[]
  >([]); // speichert die liste der erfassten fenster

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  async function getWindowTitle() {
    const title = await invoke<string>("get_current_window");
    setWindowTitle(title);
  }

  async function startTracking() {
    await invoke("start_tracking");
    setIsTracking(true);
  }
  async function stopTracking() {
    await invoke("stop_tracking");
    setIsTracking(false);
  }

  // ladet daten vom backend und aktualisiert die activities liste
  useEffect(() => {
    // Auf Events vom Backend hören, läuft einmal beim start
    const unlisten = listen<{ title: string; timestamp: number }>(
      "new-activity",
      (event) => {
        setActivities((prev) => [...prev, event.payload]);
      },
    );
    // Cleanup
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []); //leeres array, nur beim ersten render ausführen

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        78
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
      <button onClick={getWindowTitle}>Fenstertitel holen</button>
      <p>{windowTitle}</p>

      {/* Tracking Controls */}
      <div style={{ marginTop: "20px" }}>
        <h2>Tracking</h2>
        {!isTracking ? (
          <button onClick={startTracking}>▶ Start Tracking</button>
        ) : (
          <button onClick={stopTracking}>⏹ Stop Tracking</button>
        )}
        <p>Status: {isTracking ? "Läuft..." : "Gestoppt"}</p>
      </div>
      {/* Aktivitäten-Liste */}
      <div style={{ marginTop: "20px" }}>
        <h2>Erfasste Fenster ({activities.length})</h2>
        <ul style={{ textAlign: "left", maxHeight: "200px", overflow: "auto" }}>
          {activities.map((activity, index) => (
            <li key={index}>
              {new Date(activity.timestamp * 1000).toLocaleTimeString()}:{" "}
              {activity.title}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default App;
