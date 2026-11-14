import React from "react";
import { Activity, ShieldCheck, Mic, Terminal } from "lucide-react";
import { useSystemStore } from "../../stores/systemStore";

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  const { operatorName } = useSystemStore();
  const suggestions = [
    {
      title: "System Diagnostic",
      prompt: "Perform a system hardware diagnostic. Analyze CPU utilization, RAM headroom, and active compute mode.",
      icon: <Activity className="w-5 h-5 text-hudCyan" />,
      color: "border-hudCyan/40 hover:border-hudCyan hover:shadow-hud",
    },
    {
      title: "Architecture Brief",
      prompt: "Explain the EDITH architecture: how the decoupled voice worker, FastAPI backend, and Tauri 2 frontend interact.",
      icon: <Terminal className="w-5 h-5 text-hudBlue" />,
      color: "border-hudBlue/40 hover:border-hudBlue hover:shadow-[0_0_15px_rgba(0,114,255,0.3)]",
    },
    {
      title: "Security Protocols",
      prompt: "What are the 4 security action tiers in EDITH and how does dual-channel authorization protect against destructive commands?",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      color: "border-emerald-500/40 hover:border-emerald-400 hover:shadow-[0_0_15px_rgba(52,211,153,0.3)]",
    },
    {
      title: "Voice Pipeline Test",
      prompt: "Simulate a voice interaction flow. Confirm wake word parameters, VAD endpointing, and offline Piper TTS readiness.",
      icon: <Mic className="w-5 h-5 text-hudOrange" />,
      color: "border-hudOrange/40 hover:border-hudOrange hover:shadow-[0_0_15px_rgba(255,145,0,0.3)]",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4 py-8 select-none">
      {/* Glowing Emblem */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full border-2 border-hudCyan/50 flex items-center justify-center bg-card shadow-hudStrong animate-pulse">
          <div className="w-12 h-12 rounded-full border border-dashed border-hudCyan animate-[spin_10s_linear_infinite] flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-hudCyan shadow-[0_0_10px_#00f0ff]" />
          </div>
        </div>
      </div>

      <h2 className="text-xl md:text-2xl font-bold tracking-widest text-slate-100 font-mono mb-2 text-center uppercase">
        WELCOME BACK, {operatorName}
      </h2>
      <p className="text-xs md:text-sm text-slate-400 font-sans text-center max-w-md mb-8">
        E.D.I.T.H. systems nominal. Standing by for your instructions, Boss.
      </p>

      {/* Suggestion Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(s.prompt)}
            className={`p-4 rounded-2xl bg-card/70 border text-left transition-all backdrop-blur-md cursor-pointer group ${s.color}`}
          >
            <div className="flex items-center gap-3 mb-1.5">
              {s.icon}
              <span className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                {s.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed group-hover:text-slate-300">
              {s.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
