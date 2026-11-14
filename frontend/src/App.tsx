import React, { useEffect, useState } from "react";
import { MainHUD } from "./layouts/MainHUD";
import { SpotlightOverlay } from "./layouts/SpotlightOverlay";
import { api } from "./api/client";
import { wsClient } from "./api/ws";
import { useSystemStore } from "./stores/systemStore";
import { WindowMode } from "./types";

export const App: React.FC = () => {
  const [windowMode, setWindowMode] = useState<WindowMode>("main");
  const { setConnected, updateTelemetry, setHardwareInfo } = useSystemStore();

  useEffect(() => {
    // Detect window type from URL query param (?window=spotlight)
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("window") as WindowMode;
    if (mode === "spotlight") {
      setWindowMode("spotlight");
    }

    // Initialize Backend API probes
    const initBackend = async () => {
      try {
        const health = await api.checkHealth();
        setHardwareInfo(health.hardware, health.models.routing_model);
        setConnected(true);
      } catch (e) {
        console.warn("Backend not yet reachable on startup:", e);
        setConnected(false);
      }
    };

    initBackend();

    // Setup WebSocket event hooks
    wsClient.on("CONNECTION_STATUS", (payload) => {
      setConnected(payload.connected);
      if (payload.connected) {
        initBackend();
      }
    });

    wsClient.on("TELEMETRY", (payload) => {
      updateTelemetry(payload);
    });

    wsClient.connect();

    return () => {
      wsClient.close();
    };
  }, [setConnected, updateTelemetry, setHardwareInfo]);

  if (windowMode === "spotlight") {
    return <SpotlightOverlay />;
  }

  return <MainHUD />;
};

export default App;
