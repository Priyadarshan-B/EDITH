import React, { useState } from "react";
import {
  Activity,
  Bot,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Send,
  Shield,
} from "lucide-react";
import { useSystemStore } from "../stores/systemStore";
import { useVoiceStore } from "../stores/voiceStore";
import { useChatStore } from "../stores/chatStore";
import { StatusPill } from "../components/hud/StatusPill";
import { TelemetryCard } from "../components/hud/TelemetryCard";
import { AudioOrb } from "../components/voice/AudioOrb";

export const MainHUD: React.FC = () => {
  const { isConnected, hardwareMode, activeModel, hardware } = useSystemStore();
  const { wakeWordEnabled, setWakeWordEnabled } = useVoiceStore();
  const { messages, addMessage } = useChatStore();
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "system" | "security">("chat");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    addMessage({
      role: "user",
      content: inputText,
    });

    const userPrompt = inputText;
    setInputText("");

    // Temporary simulated assistant response for Milestone 1 verification
    setTimeout(() => {
      addMessage({
        role: "assistant",
        content: `Acknowledged: "${userPrompt}". Backend bridge verified. Core AI orchestration models will be activated in Milestone 2.`,
        modelUsed: activeModel,
      });
    }, 400);
  };

  return (
    <div className="flex h-screen w-screen bg-background text-slate-100 overflow-hidden select-none">
      {/* Sidebar Navigation */}
      <aside className="w-16 md:w-20 border-r border-border/80 bg-card/60 backdrop-blur-xl flex flex-col items-center py-6 justify-between z-20">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-xl bg-hudCyan/10 border border-hudCyan flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            <Radio className="w-5 h-5 text-hudCyan animate-pulse" />
          </div>

          <nav className="flex flex-col gap-4 mt-4">
            <button
              onClick={() => setActiveTab("chat")}
              className={`p-3 rounded-xl transition-all ${
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
              className={`p-3 rounded-xl transition-all ${
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
              className={`p-3 rounded-xl transition-all ${
                activeTab === "security"
                  ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/50 shadow-hud"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
              title="Security & Permissions"
            >
              <Shield className="w-5 h-5" />
            </button>
          </nav>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
            className={`p-2.5 rounded-xl border transition-all ${
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

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,114,255,0.15),rgba(255,255,255,0))]">
        {/* Top Holographic Header */}
        <header className="h-16 border-b border-border/80 px-6 flex items-center justify-between bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-widest text-slate-100 font-mono">
              E.D.I.T.H.
            </h1>
            <span className="text-[10px] font-mono text-hudCyan/80 px-2 py-0.5 rounded border border-hudCyan/30 bg-hudCyan/10">
              v0.1.0-alpha
            </span>
          </div>

          {/* Real-time Status Pills */}
          <div className="flex items-center gap-3">
            <StatusPill
              label="Backend"
              value={isConnected ? "ONLINE" : "OFFLINE"}
              status={isConnected ? "active" : "offline"}
            />
            <StatusPill
              label="Compute"
              value={hardwareMode}
              status={hardware?.has_cuda ? "active" : "active"}
            />
            <StatusPill
              label="Model"
              value={activeModel}
              status="active"
            />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Chat / Display Column */}
          <div className="flex-1 flex flex-col h-full justify-between p-6">
            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="text-[10px] font-mono text-slate-500 mb-1 px-1 flex items-center gap-1.5">
                    {msg.role === "assistant" && <Bot className="w-3 h-3 text-hudCyan" />}
                    <span>{msg.role.toUpperCase()}</span>
                    {msg.modelUsed && <span className="text-slate-600">({msg.modelUsed})</span>}
                  </div>
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed backdrop-blur-md ${
                      msg.role === "user"
                        ? "bg-hudBlue/20 border border-hudBlue/40 text-slate-100 shadow-[0_0_12px_rgba(0,114,255,0.2)]"
                        : "bg-card/80 border border-border/80 text-slate-200 shadow-hud"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask EDITH or execute command... ('Hey EDITH' enabled)"
                  className="w-full bg-card/80 border border-border/80 rounded-xl px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-hudCyan focus:ring-1 focus:ring-hudCyan shadow-inner font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-5 py-3.5 rounded-xl bg-hudCyan/20 hover:bg-hudCyan/30 border border-hudCyan text-hudCyan font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,240,255,0.3)] cursor-pointer"
              >
                <span>Execute</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Right Information & Voice Hub */}
          <div className="w-80 border-l border-border/80 bg-card/30 backdrop-blur-lg p-6 flex flex-col justify-between hidden lg:flex">
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-6 bg-card/40 border border-border/60 rounded-2xl shadow-hud">
                <AudioOrb size="md" />
                <span className="text-xs font-mono text-slate-400 mt-4 tracking-widest uppercase">
                  Voice Subsystem
                </span>
                <span className="text-[11px] font-mono text-hudCyan mt-1">
                  {wakeWordEnabled ? "Trigger: 'Hey EDITH'" : "Mic Standby"}
                </span>
              </div>

              <TelemetryCard />
            </div>

            <div className="text-[11px] font-mono text-slate-500 text-center border-t border-border/50 pt-4">
              Local-First AI OS Architecture | Windows 11
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
