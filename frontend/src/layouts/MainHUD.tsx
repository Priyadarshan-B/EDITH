import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Brain,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Send,
  Shield,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useSystemStore } from "../stores/systemStore";
import { useVoiceStore } from "../stores/voiceStore";
import { useChatStore } from "../stores/chatStore";
import { StatusPill } from "../components/hud/StatusPill";
import { TelemetryCard } from "../components/hud/TelemetryCard";
import { ModelSelector } from "../components/hud/ModelSelector";
import { AudioOrb } from "../components/voice/AudioOrb";
import { MessageItem } from "../components/chat/MessageItem";
import { EmptyState } from "../components/chat/EmptyState";
import { ConversationSidebar } from "../components/chat/ConversationSidebar";
import { SecurityAuditTab } from "../components/security/SecurityAuditTab";
import { SystemTab } from "../components/system/SystemTab";
import { MemoryTab } from "../components/memory/MemoryTab";
import { ProductivityTab } from "../components/productivity/ProductivityTab";
import { ActionConfirmationModal } from "../components/security/ActionConfirmationModal";
import { speakText, stopSpeech } from "../utils/speech";
import { api, StoredMessage, PendingActionItem } from "../api/client";
import { wsClient } from "../api/ws";

export const MainHUD: React.FC = () => {
  const { isConnected, hardware, operatorName, setOperatorProfile } = useSystemStore();
  const { wakeWordEnabled, setWakeWordEnabled, ttsEnabled, setTtsEnabled } = useVoiceStore();
  const {
    messages,
    activeConversationId,
    isStreaming,
    activeModel,
    setConversations,
    setActiveConversationId,
    setMessages,
    addMessage,
    appendStreamToken,
    finishStreaming,
    clearMessages,
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "system" | "security" | "memory" | "productivity">("chat");
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingActionItem | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Hook WebSocket for ACTION_REQUIRED security challenge
  useEffect(() => {
    // Load operator profile
    api.getOperatorProfile().then((prof) => {
      if (prof?.name) {
        setOperatorProfile(prof.name, prof.title);
      }
    }).catch(() => {});

    const unsub = wsClient.on("ACTION_REQUIRED", (payload) => {
      if (payload?.action_id) {
        setPendingAction(payload as PendingActionItem);
      }
    });
    return () => {
      unsub();
    };
  }, []);

  // Load conversation list from SQLite on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const list = await api.getConversations();
        setConversations(list);
      } catch (e) {
        console.warn("Could not fetch conversations:", e);
      }
    };
    if (isConnected) {
      loadConversations();
    }
  }, [isConnected, setConversations]);

  // Load specific conversation messages
  const handleSelectConversation = async (id: string) => {
    try {
      setActiveConversationId(id);
      const stored = await api.getConversationMessages(id);
      setMessages(
        stored.map((m: StoredMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          modelUsed: m.model_used,
          timestamp: new Date(m.created_at).getTime(),
        }))
      );
    } catch (e) {
      console.error("Failed to load conversation messages:", e);
    }
  };

  const handleNewConversation = () => {
    clearMessages();
  };

  // Submit and stream chat message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isStreaming) return;

    setInputText("");

    // Add user message to UI state
    addMessage({
      role: "user",
      content: text,
    });

    // Prepare message array for API
    const contextMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    // Add empty assistant placeholder message
    addMessage({
      role: "assistant",
      content: "",
      modelUsed: activeModel,
      isStreaming: true,
    });

    await api.streamChat(
      contextMessages,
      activeConversationId,
      (convId, _msgId, _model) => {
        if (!activeConversationId) {
          setActiveConversationId(convId);
          api.getConversations().then(setConversations).catch(() => {});
        }
      },
      (token) => {
        appendStreamToken(token);
      },
      (_convId) => {
        finishStreaming();
        // Speak response aloud in EDITH's voice
        if (useVoiceStore.getState().ttsEnabled) {
          const allMsgs = useChatStore.getState().messages;
          const last = allMsgs[allMsgs.length - 1];
          if (last && last.role === "assistant" && last.content) {
            speakText(last.content);
          }
        }
      },
      (err) => {
        appendStreamToken(`\n[Streaming Error: ${err}]`);
        finishStreaming();
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen w-screen bg-background text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. Left Primary Dock */}
      <aside className="w-16 md:w-20 border-r border-border/80 bg-card/60 backdrop-blur-xl flex flex-col items-center py-6 justify-between z-30">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-xl bg-hudCyan/10 border border-hudCyan flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            <Radio className="w-5 h-5 text-hudCyan animate-pulse" />
          </div>

          <nav className="flex flex-col gap-4 mt-4">
            <button
              onClick={() => setActiveTab("chat")}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/50 shadow-hud"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
              title="Command Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("system")}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "system"
                  ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/50 shadow-hud"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
              title="System Telemetry"
            >
              <Activity className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "security"
                  ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/50 shadow-hud"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
              title="Security & Permissions"
            >
              <Shield className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("memory")}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "memory"
                  ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/50 shadow-hud"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
              title="Semantic Memory & Vector Index"
            >
              <Brain className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("productivity")}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                activeTab === "productivity"
                  ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/50 shadow-hud"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
              title="Productivity & Tasks"
            >
              <CheckSquare className="w-5 h-5" />
            </button>
          </nav>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              wakeWordEnabled
                ? "border-hudCyan/50 bg-hudCyan/10 text-hudCyan shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                : "border-slate-800 text-slate-500"
            }`}
            title={wakeWordEnabled ? "Wake word active ('Hey EDITH')" : "Wake word disabled"}
          >
            {wakeWordEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* 2. Collapsible Conversation History Drawer (only in Chat mode) */}
      {showHistoryDrawer && activeTab === "chat" && (
        <ConversationSidebar
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      )}

      {/* 3. Main Workspace Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,114,255,0.12),rgba(255,255,255,0))]">
        {/* Top Holographic Navigation Bar */}
        <header className="h-16 border-b border-border/80 px-6 flex items-center justify-between bg-card/50 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            {activeTab === "chat" && (
              <button
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="p-1.5 rounded-lg border border-border/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
                title={showHistoryDrawer ? "Hide Sessions" : "Show Sessions"}
              >
                {showHistoryDrawer ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}

            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-widest text-slate-100 font-mono">
                E.D.I.T.H.
              </h1>
              <span className="text-[10px] font-mono text-hudCyan/90 px-2 py-0.5 rounded border border-hudCyan/40 bg-hudCyan/10">
                PROMPT 2.0
              </span>
              <span className="text-[10px] font-mono text-hudBlue px-2 py-0.5 rounded border border-hudBlue/40 bg-hudBlue/10 font-semibold tracking-wider uppercase">
                {operatorName}
              </span>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (ttsEnabled) stopSpeech();
                setTtsEnabled(!ttsEnabled);
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                ttsEnabled
                  ? "border-hudCyan/50 bg-hudCyan/10 text-hudCyan shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                  : "border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
              title={ttsEnabled ? "Voice Output Active (Click to Mute)" : "Voice Output Muted (Click to Enable)"}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <StatusPill
              label="Backend"
              value={isConnected ? "ONLINE" : "DISCONNECTED"}
              status={isConnected ? "active" : "offline"}
            />
            <ModelSelector />
          </div>
        </header>

        {/* Dynamic Tab Views */}
        {activeTab === "system" ? (
          <SystemTab />
        ) : activeTab === "security" ? (
          <SecurityAuditTab />
        ) : activeTab === "memory" ? (
          <MemoryTab />
        ) : activeTab === "productivity" ? (
          <ProductivityTab />
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Main Chat Stream View */}
            <div className="flex-1 flex flex-col h-full justify-between p-6">
              {/* Messages Scroll Container */}
              <div className="flex-1 overflow-y-auto pr-3 scrollbar-thin">
                {messages.length === 0 ? (
                  <EmptyState onSelectPrompt={(p) => handleSendMessage(p)} />
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageItem key={msg.id} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Premium Input Console */}
              <div className="mt-4 pt-2 border-t border-border/60">
                <div className="relative flex items-center bg-card/90 border border-border/90 rounded-2xl p-2 shadow-hud backdrop-blur-xl focus-within:border-hudCyan/70 focus-within:shadow-hudStrong transition-all">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Instruct EDITH or execute desktop action... [Model: ${activeModel}]`}
                    rows={1}
                    className="w-full bg-transparent border-0 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-mono scrollbar-none"
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                  />

                  <div className="flex items-center gap-2 pr-1">
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputText.trim() || isStreaming}
                      className="p-3 rounded-xl bg-hudCyan/20 hover:bg-hudCyan/30 border border-hudCyan text-hudCyan transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                      title="Send Directive (Enter)"
                    >
                      {isStreaming ? (
                        <Square className="w-4 h-4 animate-spin text-hudCyan" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Console Micro-Footer */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-3 pt-2">
                  <span>Enter to dispatch • Shift+Enter for newline</span>
                  <span className="flex items-center gap-1.5 text-hudCyan/70">
                    <Sparkles className="w-3 h-3" />
                    <span>Dual-Channel Security Authorization Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Telemetry & Voice Panel */}
            <div className="w-80 border-l border-border/80 bg-card/30 backdrop-blur-lg p-6 flex flex-col justify-between hidden xl:flex">
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center py-6 bg-card/40 border border-border/60 rounded-2xl shadow-hud">
                  <AudioOrb size="md" />
                  <span className="text-xs font-mono text-slate-400 mt-4 tracking-widest uppercase">
                    Voice Subsystem
                  </span>
                  <span className="text-[11px] font-mono text-hudCyan mt-1">
                    {wakeWordEnabled ? "Wake Trigger: 'Hey EDITH'" : "Standby"}
                  </span>
                </div>

                <TelemetryCard />
              </div>

              <div className="text-[11px] font-mono text-slate-500 text-center border-t border-border/50 pt-4">
                {hardware?.has_cuda ? "NVIDIA CUDA Accelerated" : "AMD Ryzen Zen 2 CPU Engine"}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. Action Confirmation Modal for Destructive Operations */}
      <ActionConfirmationModal
        pendingAction={pendingAction}
        onResolved={() => setPendingAction(null)}
      />
    </div>
  );
};
