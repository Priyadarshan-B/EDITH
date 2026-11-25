import React, { useEffect, useRef, useState } from "react";
import { Radio, Terminal, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../../api/client";

interface BootLoaderProps {
  backendReady: boolean;
  briefingReady: boolean;
  onFinished: () => void;
}

export const BootLoader: React.FC<BootLoaderProps> = ({
  backendReady,
  briefingReady,
  onFinished,
}) => {
  const [progress, setProgress] = useState(15);
  const [bootLines, setBootLines] = useState<string[]>([
    "Connecting to EDITH AI Core Backend...",
  ]);
  const [voiceReady, setVoiceReady] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const pollLogs = async () => {
      try {
        const res = await api.getBootLogs(30);
        if (!active) return;
        if (res.logs && res.logs.length > 0) {
          setBootLines(res.logs);
        }
        if (res.voice_ready) setVoiceReady(true);
      } catch {
        // Backend still initializing
      }
    };
    pollLogs();
    const id = setInterval(pollLogs, 300);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bootLines]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (backendReady && briefingReady) {
          return Math.min(100, prev + 14);
        }
        return Math.min(82, prev + 6);
      });
    }, 120);
    return () => clearInterval(timer);
  }, [backendReady, briefingReady]);

  useEffect(() => {
    if (progress >= 100 && backendReady) {
      const done = setTimeout(onFinished, 350);
      return () => clearTimeout(done);
    }
  }, [progress, backendReady, onFinished]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center hud-grid-bg bg-[#040814]/98 text-slate-100 px-4 md:px-8 select-none overflow-hidden">
      {/* Concentric Arc Reactor Boot Core */}
      <div className="relative flex items-center justify-center w-28 h-28 mb-5">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-hudCyan/40 animate-[spin_8s_linear_infinite]" />
        <div className="absolute inset-2.5 rounded-full border border-hudBlue/50 animate-[spin_5s_linear_infinite_reverse]" />
        <div className="w-16 h-16 rounded-full bg-hudCyan/10 border-2 border-hudCyan flex items-center justify-center shadow-[0_0_35px_rgba(0,240,255,0.45)]">
          <Radio className="w-7 h-7 text-hudCyan animate-pulse" />
        </div>
      </div>

      <h1 className="text-2xl md:text-3xl font-display font-bold tracking-[0.28em] text-slate-100 mb-1">
        E.D.I.T.H.
      </h1>
      <p className="text-[11px] font-mono text-hudCyan/80 tracking-widest uppercase mb-5">
        Live System &amp; Neural Subsystem Boot Sequence
      </p>

      {/* Progress Bar + Real Status Pills */}
      <div className="w-full max-w-2xl space-y-3">
        <div className="w-full h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-hudBlue via-hudCyan to-emerald-400 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
          <span className="flex items-center gap-1.5">
            {backendReady ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-hudCyan animate-spin" />
            )}
            AI Core &amp; DB
          </span>
          <span className="flex items-center gap-1.5">
            {voiceReady ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-hudCyan animate-spin" />
            )}
            Voice Engine
          </span>
          <span className="flex items-center gap-1.5">
            {briefingReady ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-hudCyan animate-spin" />
            )}
            Daily Briefing &amp; MCP
          </span>
        </div>

        {/* Live Terminal Output Stream */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-3.5 py-2 border-b border-cyan-400/15 bg-slate-950/60 flex items-center justify-between text-[11px] font-mono text-hudCyan">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Startup Terminal Stream (data/boot.log)
            </span>
            <span className="text-slate-400">{progress}%</span>
          </div>
          <div className="p-3.5 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 space-y-1 bg-black/45 scrollbar-thin">
            {bootLines.map((ln, i) => (
              <div
                key={i}
                className={
                  ln.includes("ERROR") || ln.includes("WARNING")
                    ? "text-amber-300"
                    : ln.includes("ONLINE") || ln.includes("successfully") || ln.includes("complete")
                    ? "text-emerald-300"
                    : "text-slate-300"
                }
              >
                {ln}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
