import React, { useEffect, useState } from "react";
import { MainHUD } from "./layouts/MainHUD";
import { SpotlightOverlay } from "./layouts/SpotlightOverlay";
import { api } from "./api/client";
import { wsClient } from "./api/ws";
import { useSystemStore } from "./stores/systemStore";
import { useVoiceStore } from "./stores/voiceStore";
import { useChatStore } from "./stores/chatStore";
import { WindowMode } from "./types";

export const App: React.FC = () => {
  const [windowMode, setWindowMode] = useState<WindowMode>("main");
  const { setConnected, updateTelemetry, setHardwareInfo } = useSystemStore();
  const { setState, setAudioLevel, setLastTranscript } = useVoiceStore();
  const { addMessage, appendStreamToken, finishStreaming, activeConversationId, setActiveConversationId, activeModel } = useChatStore();

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

    // 1. Connection lifecycle
    wsClient.on("CONNECTION_STATUS", (payload) => {
      setConnected(payload.connected);
      if (payload.connected) {
        initBackend();
      }
    });

    // 2. Real-time telemetry
    wsClient.on("TELEMETRY", (payload) => {
      updateTelemetry(payload);
    });

    // 3. Voice Subsystem events from decoupled worker
    wsClient.on("VOICE_STATE_CHANGED", (payload) => {
      if (payload?.state) {
        setState(payload.state);
      }
    });

    wsClient.on("AUDIO_LEVEL", (payload) => {
      if (typeof payload?.level === "number") {
        setAudioLevel(payload.level);
      }
    });

    wsClient.on("WAKE_WORD_DETECTED", () => {
      setState("listening");
    });

    wsClient.on("USER_SPEECH_FINAL", async (payload) => {
      const speechText = payload?.text;
      if (!speechText) return;

      setLastTranscript(speechText);
      setState("processing");

      // Post speech to chat store
      addMessage({
        role: "user",
        content: speechText,
      });

      // Prepare assistant placeholder
      addMessage({
        role: "assistant",
        content: "",
        modelUsed: activeModel,
        isStreaming: true,
      });

      let completeAnswer = "";

      await api.streamChat(
        [{ role: "user", content: speechText }],
        activeConversationId,
        (convId) => {
          if (!activeConversationId) {
            setActiveConversationId(convId);
          }
        },
        (token) => {
          completeAnswer += token;
          appendStreamToken(token);
        },
        () => {
          finishStreaming();
          // Request audio synthesis from Piper TTS via IPC
          if (completeAnswer.trim()) {
            wsClient.send("SYNTHESIZE_AND_PLAY", { text: completeAnswer.slice(0, 300) });
          }
        },
        (err) => {
          appendStreamToken(`\n[Streaming Error: ${err}]`);
          finishStreaming();
          setState("idle");
        }
      );
    });

    wsClient.connect();

    return () => {
      wsClient.close();
    };
  }, [
    setConnected,
    updateTelemetry,
    setHardwareInfo,
    setState,
    setAudioLevel,
    setLastTranscript,
    addMessage,
    appendStreamToken,
    finishStreaming,
    activeConversationId,
    setActiveConversationId,
    activeModel,
  ]);

  if (windowMode === "spotlight") {
    return <SpotlightOverlay />;
  }

  return <MainHUD />;
};

export default App;
