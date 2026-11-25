/**
 * Dynamic API & WebSocket Base URL resolution for Desktop (Tauri), Web, PWA, and Mobile (Capacitor).
 */

const STORAGE_KEY = "edith_server_url";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, "");
    }
    const { protocol, hostname, port } = window.location;
    const isTauriOrLocal =
      !hostname ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "tauri.localhost" ||
      hostname.endsWith(".localhost") ||
      protocol === "tauri:" ||
      protocol === "capacitor:";

    // When served directly by EDITH backend (port 18425) over LAN or localhost
    if (!isTauriOrLocal && (protocol === "http:" || protocol === "https:") && port === "18425") {
      return `${protocol}//${hostname}:18425`;
    }
    // When running Vite dev server over LAN (e.g. mobile testing http://192.168.x.x:1420)
    if (!isTauriOrLocal && (protocol === "http:" || protocol === "https:")) {
      return `${protocol}//${hostname}:18425`;
    }
  }
  return "http://127.0.0.1:18425";
}

export function setApiBase(url: string): void {
  if (typeof window === "undefined") return;
  const cleaned = url.trim().replace(/\/+$/, "");
  if (!cleaned) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, cleaned);
  }
}

export function getWsUrl(): string {
  const base = getApiBase();
  if (base.startsWith("https://")) {
    return base.replace(/^https:\/\//, "wss://") + "/ws/events";
  }
  return base.replace(/^http:\/\//, "ws://") + "/ws/events";
}
