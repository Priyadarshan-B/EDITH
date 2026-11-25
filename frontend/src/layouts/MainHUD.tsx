import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Brain,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  FolderGit2,
  Loader2,
  MemoryStick,
  MessageSquare,
  Mic,
  MicOff,
  MousePointer2,
  Plug,
  Radio,
  Send,
  Shield,
  Sliders,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSystemStore } from "../stores/systemStore";
import { useVoiceStore } from "../stores/voiceStore";
import { useChatStore } from "../stores/chatStore";
import { StatusPill } from "../components/hud/StatusPill";
import { ModelSelector } from "../components/hud/ModelSelector";
import { AudioOrb } from "../components/voice/AudioOrb";
import { MessageItem } from "../components/chat/MessageItem";
import { EmptyState } from "../components/chat/EmptyState";
import { ConversationSidebar } from "../components/chat/ConversationSidebar";
import { SecurityAuditTab } from "../components/security/SecurityAuditTab";
import { SystemTab } from "../components/system/SystemTab";
import { MemoryTab } from "../components/memory/MemoryTab";
import { ProductivityTab } from "../components/productivity/ProductivityTab";
import { DatabaseTab } from "../components/database/DatabaseTab";
import { WorkspacesTab } from "../components/workspaces/WorkspacesTab";
import { MCPTab } from "../components/mcp/MCPTab";
import { VirtualMousePanel } from "../components/vision/VirtualMousePanel";
import { VirtualMouseTracker } from "../components/vision/VirtualMouseTracker";
import { ActionConfirmationModal } from "../components/security/ActionConfirmationModal";
import { speakText, stopSpeech } from "../utils/speech";
import { api, StoredMessage, PendingActionItem, VirtualMouseStatus } from "../api/client";
import { wsClient } from "../api/ws";

export const MainHUD: React.FC = () => {
  const { isConnected, hardware, cpuPercent, ramUsedGb, ramTotalGb, operatorName, setOperatorProfile } = useSystemStore();
  const {
    state: voiceState,
    wakeWordEnabled,
    setWakeWordEnabled,
    ttsEnabled,
    setTtsEnabled,
    lastTranscript,
  } = useVoiceStore();
  const [virtualMouseOn, setVirtualMouseOn] = useState(false);
  const [virtualMouseStatus, setVirtualMouseStatus] = useState<VirtualMouseStatus | null>(null);
  const [showMousePanel, setShowMousePanel] = useState(false);
  const [showMousePreview, setShowMousePreview] = useState(true);
  const [liveGesture, setLiveGesture] = useState("idle");

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
  const [activeTab, setActiveTab] = useState<
    "chat" | "system" | "security" | "memory" | "productivity" | "database" | "workspaces" | "mcp"
  >("chat");
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false
  );
  const [pendingAction, setPendingAction] = useState<PendingActionItem | null>(null);
  const [slowLoadingMsg, setSlowLoadingMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    api
      .getOperatorProfile()
      .then((prof) => {
        if (prof?.name) {
          setOperatorProfile(prof.name, prof.title);
        }
      })
      .catch(() => {});

    const unsub = wsClient.on("ACTION_REQUIRED", (payload) => {
      if (payload?.action_id) {
        setPendingAction(payload as PendingActionItem);
      }
    });
    return () => {
      unsub();
    };
  }, []);

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

  useEffect(() => {
    api
      .getVirtualMouseStatus()
      .then((st) => {
        setVirtualMouseStatus(st);
        setVirtualMouseOn(st.enabled);
      })
      .catch(() => {});
  }, []);

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

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isStreaming) return;

    setInputText("");
    addMessage({ role: "user", content: text });

    const contextMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    addMessage({
      role: "assistant",
      content: "",
      modelUsed: activeModel,
      isStreaming: true,
    });

    let firstTokenSeen = false;
    const slowTimer = window.setTimeout(() => {
      if (!firstTokenSeen) {
        setSlowLoadingMsg("Thinking on it, Boss... fetching everything cleanly!");
        if (useVoiceStore.getState().ttsEnabled) {
          speakText("One sec Boss, still working on that for you.");
        }
      }
    }, 3500);

    await api.streamChat(
      contextMessages,
      activeConversationId,
      (convId) => {
        if (!activeConversationId) {
          setActiveConversationId(convId);
          api.getConversations().then(setConversations).catch(() => {});
        }
      },
      (token) => {
        if (!firstTokenSeen) {
          firstTokenSeen = true;
          window.clearTimeout(slowTimer);
          setSlowLoadingMsg(null);
        }
        appendStreamToken(token);
      },
      () => {
        window.clearTimeout(slowTimer);
        setSlowLoadingMsg(null);
        finishStreaming();
        if (useVoiceStore.getState().ttsEnabled) {
          const allMsgs = useChatStore.getState().messages;
          const last = allMsgs[allMsgs.length - 1];
          if (last && last.role === "assistant" && last.content) {
            speakText(last.content);
          }
        }
      },
      (err) => {
        window.clearTimeout(slowTimer);
        setSlowLoadingMsg(null);
        appendStreamToken(`\n[Streaming Error: ${err}]`);
        finishStreaming();
      }
    );
  };

  const handleToggleVirtualMouse = async () => {
    try {
      const next = !virtualMouseOn;
      const status = await api.toggleVirtualMouse(next);
      setVirtualMouseStatus(status);
      setVirtualMouseOn(status.enabled);
      if (status.enabled) {
        setShowMousePreview(true);
      } else if (status.last_error) {
        alert(`Virtual Mouse Error: ${status.last_error}`);
      }
    } catch (e) {
      console.error("Virtual mouse toggle error:", e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const navItems = [
    { id: "chat", icon: MessageSquare, label: "HUD Core" },
    { id: "workspaces", icon: FolderGit2, label: "Workspaces & Build" },
    { id: "mcp", icon: Plug, label: "MCP Hub" },
    { id: "productivity", icon: CheckSquare, label: "Tasks & Brief" },
    { id: "memory", icon: Brain, label: "Memory & Learn" },
    { id: "security", icon: Shield, label: "Security Audit" },
    { id: "system", icon: Activity, label: "System & Voice" },
    { id: "database", icon: Database, label: "SQLite Vault" },
  ] as const;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen hud-grid-bg bg-[#040814]/95 text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. Left Primary Translucent Dock (Desktop/Tablet) */}
      <aside className="hidden md:flex w-16 lg:w-20 border-r border-cyan-400/15 bg-slate-950/45 backdrop-blur-2xl flex-col items-center py-5 justify-between z-30 shrink-0">
        <div className="flex flex-col items-center gap-5">
          <div className="w-10 h-10 rounded-xl bg-hudCyan/10 border border-hudCyan/60 flex items-center justify-center shadow-[0_0_18px_rgba(0,240,255,0.4)]">
            <Radio className="w-5 h-5 text-hudCyan animate-pulse" />
          </div>

          <nav className="flex flex-col gap-2.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`p-3 rounded-xl transition-all cursor-pointer ${
                    active
                      ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/50 shadow-hud"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </nav>
        </div>

        <button
          onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            wakeWordEnabled
              ? "border-hudCyan/50 bg-hudCyan/10 text-hudCyan shadow-[0_0_12px_rgba(0,240,255,0.2)]"
              : "border-slate-800 text-slate-500"
          }`}
          title={wakeWordEnabled ? "Wake word active ('Hey EDITH')" : "Wake word paused"}
        >
          {wakeWordEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
      </aside>

      {/* 2. Collapsible Conversation History Drawer */}
      {showHistoryDrawer && activeTab === "chat" && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setShowHistoryDrawer(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 md:static md:z-auto h-full bg-slate-950/60 backdrop-blur-2xl">
            <ConversationSidebar
              onSelectConversation={(id) => {
                handleSelectConversation(id);
                if (window.innerWidth < 768) setShowHistoryDrawer(false);
              }}
              onNewConversation={() => {
                handleNewConversation();
                if (window.innerWidth < 768) setShowHistoryDrawer(false);
              }}
            />
          </div>
        </>
      )}

      {/* 3. Main Transparent HUD Shell */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Holographic Header */}
        <header className="h-14 md:h-16 border-b border-cyan-400/15 px-3 md:px-6 flex items-center justify-between gap-2 bg-slate-950/35 backdrop-blur-2xl z-20 shrink-0">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            {activeTab === "chat" && (
              <button
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="p-1.5 rounded-lg border border-cyan-400/20 bg-slate-900/50 text-slate-400 hover:text-hudCyan transition-all cursor-pointer"
                title={showHistoryDrawer ? "Hide Sessions" : "Show Sessions"}
              >
                {showHistoryDrawer ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full lg:hidden ${
                  isConnected ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-500"
                }`}
              />
              <h1 className="text-base md:text-xl font-bold tracking-[0.22em] text-slate-100 font-display truncate">
                E.D.I.T.H.
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-mono text-hudCyan/90 px-2 py-0.5 rounded-full border border-hudCyan/35 bg-hudCyan/10">
                NEURAL HUD
              </span>
              <span className="hidden lg:inline-block text-[10px] font-mono text-sky-300 px-2 py-0.5 rounded-full border border-sky-400/30 bg-sky-500/10 font-semibold tracking-wider uppercase">
                {operatorName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
            <div className="flex items-center rounded-xl border border-cyan-400/20 bg-slate-900/50 overflow-hidden">
              <button
                onClick={handleToggleVirtualMouse}
                className={`flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 text-xs font-mono transition-all cursor-pointer ${
                  virtualMouseOn
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={virtualMouseOn ? "Disable Camera Virtual Mouse" : "Enable Camera Virtual Mouse"}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{virtualMouseOn ? "Cam Mouse ON" : "Cam Mouse"}</span>
              </button>
              <button
                onClick={() => setShowMousePanel(true)}
                className="px-2 py-1.5 border-l border-cyan-400/15 text-slate-400 hover:text-hudCyan transition-all cursor-pointer"
                title="Virtual Mouse Options & Gesture Guide"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => {
                if (ttsEnabled) stopSpeech();
                setTtsEnabled(!ttsEnabled);
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                ttsEnabled
                  ? "border-hudCyan/50 bg-hudCyan/10 text-hudCyan shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                  : "border-slate-800 bg-slate-900/50 text-slate-500 hover:text-slate-300"
              }`}
              title={ttsEnabled ? "Voice Output Active" : "Voice Output Muted"}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <div className="hidden lg:block">
              <StatusPill
                label="Core"
                value={isConnected ? "ONLINE" : "OFFLINE"}
                status={isConnected ? "active" : "offline"}
              />
            </div>
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
        ) : activeTab === "database" ? (
          <DatabaseTab />
        ) : activeTab === "workspaces" ? (
          <WorkspacesTab />
        ) : activeTab === "mcp" ? (
          <MCPTab />
        ) : (
          /* Center Speak Arc + Right AI Response Split HUD */
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* CENTER: Hero Speak Arc & Command Composer */}
            <section className="flex-1 flex flex-col justify-between p-3 md:p-6 min-w-0 overflow-hidden relative">
              {/* Speak Arc Hero Centerpiece */}
              <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 py-2">
                <div className="glass-panel rounded-3xl px-6 py-6 md:px-12 md:py-9 flex flex-col items-center justify-center relative shadow-[0_0_45px_rgba(0,240,255,0.08)] w-full max-w-md">
                  <div className="text-[10px] font-mono tracking-[0.28em] text-hudCyan/80 uppercase mb-4">
                    Speak Arc • Neural Voice Core
                  </div>

                  <AudioOrb size="lg" />

                  <div className="mt-4 text-center space-y-1.5 max-w-xs">
                    <div className="text-xs font-mono text-slate-300">
                      {voiceState === "speaking"
                        ? "EDITH is speaking..."
                        : voiceState === "listening"
                        ? "Listening to you, Boss..."
                        : voiceState === "processing"
                        ? "Processing instruction..."
                        : wakeWordEnabled
                        ? "Say 'Hey EDITH' or type below"
                        : "Voice standby • Type below"}
                    </div>

                    {lastTranscript && (
                      <div className="px-3 py-1 rounded-full bg-hudCyan/10 border border-hudCyan/25 text-[11px] font-mono text-hudCyan truncate">
                        &ldquo;{lastTranscript}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Quick Voice/Command Shortcuts */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                    {[
                      { label: "Latest News", prompt: "Tell me the latest tech and world news" },
                      { label: "My Plans", prompt: "What are my plans" },
                      { label: "Diagnostics", prompt: "Run system hardware diagnostic" },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        onClick={() => handleSendMessage(chip.prompt)}
                        className="px-3 py-1 rounded-full text-[11px] font-mono border border-cyan-400/25 bg-slate-900/50 hover:bg-hudCyan/15 hover:border-hudCyan/50 text-slate-300 hover:text-hudCyan transition-all cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Frosted Glass Input Console */}
              <div className="pt-2 shrink-0">
                <div className="relative flex items-center glass-panel rounded-2xl p-2 shadow-hud focus-within:border-hudCyan/70 focus-within:shadow-hudStrong transition-all">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Speak or instruct EDITH... [${activeModel}]`}
                    rows={1}
                    className="w-full bg-transparent border-0 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none resize-none font-sans scrollbar-none"
                    style={{ minHeight: "42px", maxHeight: "110px" }}
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isStreaming}
                    className="p-3 rounded-xl bg-hudCyan/20 hover:bg-hudCyan/30 border border-hudCyan text-hudCyan transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.25)] shrink-0"
                    title="Send Directive (Enter)"
                  >
                    {isStreaming ? (
                      <Square className="w-4 h-4 animate-spin text-hudCyan" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="hidden sm:flex items-center justify-between text-[11px] font-mono text-slate-500 px-3 pt-1.5">
                  <span>Enter to send • Shift+Enter for newline</span>
                  <span className="flex items-center gap-1.5 text-hudCyan/75">
                    <Sparkles className="w-3 h-3" />
                    <span>Auto Online News + Local Learning Active</span>
                  </span>
                </div>
              </div>
            </section>

            {/* RIGHT: Dedicated Live AI Response & Telemetry Stream */}
            <aside className="w-full lg:w-[46%] xl:w-[44%] h-[44%] lg:h-full border-t lg:border-t-0 lg:border-l border-cyan-400/15 bg-slate-950/35 backdrop-blur-2xl flex flex-col overflow-hidden shrink-0">
              {/* Response Panel Header + Compact Telemetry */}
              <div className="px-4 py-3 border-b border-cyan-400/15 flex items-center justify-between gap-2 bg-slate-950/30 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-hudCyan" />
                  <span className="text-xs font-display tracking-widest uppercase text-slate-200">
                    Response Stream
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-hudCyan" />
                    {cpuPercent.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <MemoryStick className="w-3.5 h-3.5 text-emerald-400" />
                    {ramUsedGb.toFixed(1)}/{ramTotalGb.toFixed(0)}G
                  </span>
                  <span className="hidden xl:inline text-slate-500">
                    {hardware?.has_cuda ? "CUDA" : "CPU"}
                  </span>
                </div>
              </div>

              {/* Scrollable Responses */}
              <div className="flex-1 overflow-y-auto p-3 md:p-5 scrollbar-thin">
                {messages.length === 0 ? (
                  <EmptyState onSelectPrompt={(p) => handleSendMessage(p)} />
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageItem key={msg.id} message={msg} />
                    ))}
                    {slowLoadingMsg && (
                      <div className="flex items-center gap-2 px-3 py-2 my-1 rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-xs font-mono text-hudCyan animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>{slowLoadingMsg}</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden flex items-center justify-around border-t border-cyan-400/15 bg-slate-950/75 backdrop-blur-2xl py-1.5 px-1 shrink-0 z-30">
          {[
            { id: "chat", icon: MessageSquare, label: "HUD" },
            { id: "workspaces", icon: FolderGit2, label: "Build" },
            { id: "mcp", icon: Plug, label: "MCP" },
            { id: "productivity", icon: CheckSquare, label: "Tasks" },
            { id: "memory", icon: Brain, label: "Learn" },
            { id: "security", icon: Shield, label: "Sec" },
            { id: "system", icon: Activity, label: "Sys" },
            { id: "database", icon: Database, label: "DB" },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-mono transition-all cursor-pointer ${
                  active ? "text-hudCyan bg-hudCyan/15" : "text-slate-400"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>

      {/* 4. Action Confirmation Modal for Destructive Operations */}
      <ActionConfirmationModal
        pendingAction={pendingAction}
        onResolved={() => setPendingAction(null)}
      />

      {/* 5. Virtual Mouse Settings & Gesture Guide Modal */}
      <VirtualMousePanel
        isOpen={showMousePanel}
        onClose={() => setShowMousePanel(false)}
        status={virtualMouseStatus}
        onStatusChange={(st) => {
          setVirtualMouseStatus(st);
          setVirtualMouseOn(st.enabled);
          if (st.enabled) setShowMousePreview(true);
        }}
        showPreview={showMousePreview}
        onTogglePreview={() => setShowMousePreview((v) => !v)}
      />

      {/* 6. Floating Mini Camera Preview & MediaPipe JS Tracker */}
      {virtualMouseOn && (
        <div
          className={
            showMousePreview
              ? "fixed bottom-16 md:bottom-4 right-3 md:right-4 z-40 w-56 md:w-64 rounded-2xl border border-emerald-400/50 bg-slate-950/90 backdrop-blur-xl shadow-2xl overflow-hidden"
              : "sr-only"
          }
        >
          {showMousePreview && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 text-[11px] font-mono text-emerald-300">
              <span className="truncate">Cam Mouse: {liveGesture}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowMousePanel(true)}
                  className="text-slate-400 hover:text-hudCyan cursor-pointer"
                  title="Options"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowMousePreview(false)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="Hide preview"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <VirtualMouseTracker
            enabled={virtualMouseOn}
            config={virtualMouseStatus}
            showPreview={showMousePreview}
            onGestureChange={(g) => setLiveGesture(g)}
            onError={(err) => {
              alert(`Virtual Mouse Camera Error: ${err}`);
              api.toggleVirtualMouse(false).catch(() => {});
              setVirtualMouseOn(false);
            }}
          />
        </div>
      )}
    </div>
  );
};
