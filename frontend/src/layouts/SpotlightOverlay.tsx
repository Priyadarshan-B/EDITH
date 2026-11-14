import React, { useState } from "react";
import { Send } from "lucide-react";
import { AudioOrb } from "../components/voice/AudioOrb";
import { useVoiceStore } from "../stores/voiceStore";
import { useChatStore } from "../stores/chatStore";

export const SpotlightOverlay: React.FC = () => {
  const { state, lastTranscript } = useVoiceStore();
  const { addMessage } = useChatStore();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    addMessage({
      role: "user",
      content: query,
    });
    setQuery("");
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
      <div className="w-full max-w-xl bg-card/90 border border-hudCyan/50 rounded-3xl p-6 shadow-hudStrong flex flex-col items-center gap-6 relative">
        {/* Glow indicator bar */}
        <div className="w-24 h-1 rounded-full bg-hudCyan shadow-[0_0_10px_#00f0ff]" />

        {/* Central Voice Reactor Orb */}
        <div className="py-2">
          <AudioOrb size="lg" />
        </div>

        {/* Live Audio Transcript / State feedback */}
        <div className="text-center font-mono space-y-1">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            {state === "listening"
              ? "Listening for command..."
              : state === "processing"
              ? "Formulating execution plan..."
              : state === "speaking"
              ? "EDITH speaking..."
              : "Standing by"}
          </div>
          {lastTranscript && (
            <div className="text-sm text-hudCyan italic">"{lastTranscript}"</div>
          )}
        </div>

        {/* Quick Input Bar */}
        <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type or speak a command..."
            className="flex-1 bg-background/80 border border-border/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-hudCyan font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="p-3 rounded-xl bg-hudCyan/20 hover:bg-hudCyan/30 border border-hudCyan text-hudCyan transition-all disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="text-[10px] font-mono text-slate-500">
          Press <span className="text-slate-400 font-semibold">ESC</span> or say "Dismiss" to close overlay
        </div>
      </div>
    </div>
  );
};
