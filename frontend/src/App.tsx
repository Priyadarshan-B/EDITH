import React, { useEffect, useRef, useState } from "react";
import { MainHUD } from "./layouts/MainHUD";
import { SpotlightOverlay } from "./layouts/SpotlightOverlay";
import { BootLoader } from "./components/hud/BootLoader";
import { api } from "./api/client";
import { wsClient } from "./api/ws";
import { useSystemStore } from "./stores/systemStore";
import { useVoiceStore } from "./stores/voiceStore";
import { useChatStore } from "./stores/chatStore";
import { speakText } from "./utils/speech";
import { WindowMode } from "./types";

export const App: React.FC = () => {
  const [windowMode, setWindowMode] = useState<WindowMode>("main");
  const [isBooting, setIsBooting] = useState(true);
  const [bootBackendReady, setBootBackendReady] = useState(false);
  const [bootBriefingReady, setBootBriefingReady] = useState(false);
  const startupBriefingRef = useRef<string | null>(null);
  const greetedRef = useRef(false);
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

    // Initialize Backend API probes & startup Boss briefing (retries smoothly while backend boots in parallel)
    let cancelled = false;
    let attempt = 0;
    const initBackend = async () => {
      if (cancelled) return;
      try {
        const health = await api.checkHealth();
        if (cancelled) return;
        const detectedActiveModel = health.models.active_model || health.models.routing_model;
        setHardwareInfo(health.hardware, detectedActiveModel);
        useChatStore.getState().setActiveModel(detectedActiveModel);
        await useVoiceStore.getState().syncFromBackend();
        setConnected(true);
        setBootBackendReady(true);

        try {
          const briefing = await api.getDailyBriefing();
          startupBriefingRef.current = briefing.spoken_summary;
        } catch {
          const hr = new Date().getHours();
          const tod = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
          startupBriefingRef.current = `${tod}, Boss. All EDITH systems are online and standing by.`;
        } finally {
          setBootBriefingReady(true);
        }
      } catch (e) {
        attempt += 1;
        setConnected(false);
        if (attempt < 35 && !cancelled) {
          setTimeout(initBackend, 600);
        } else if (!cancelled) {
          console.warn("Backend not yet reachable on startup:", e);
          setBootBackendReady(true);
          setBootBriefingReady(true);
        }
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
          if (completeAnswer.trim()) {
            if (useVoiceStore.getState().ttsEnabled) {
              speakText(completeAnswer);
            }
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
      cancelled = true;
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

  const handleBootFinished = () => {
    setIsBooting(false);
    if (!greetedRef.current && startupBriefingRef.current && useVoiceStore.getState().ttsEnabled) {
      greetedRef.current = true;
      const summary = startupBriefingRef.current;
      speakText(summary, undefined, undefined, undefined, { summarize: false });

      // If browser/WebView blocks initial autoplay before user gesture, unlock on first click/key
      const unlock = () => {
        if (useVoiceStore.getState().state !== "speaking" && useVoiceStore.getState().ttsEnabled) {
          speakText(summary, undefined, undefined, undefined, { summarize: false });
        }
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      };
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
      setTimeout(() => {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      }, 8000);
    }
  };

  if (windowMode === "spotlight") {
    return <SpotlightOverlay />;
  }

  return (
    <>
      {isBooting && (
        <BootLoader
          backendReady={bootBackendReady}
          briefingReady={bootBriefingReady}
          onFinished={handleBootFinished}
        />
      )}
      <MainHUD />
    </>
  );
};

export default App;
