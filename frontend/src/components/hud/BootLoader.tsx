import React, { useEffect, useRef, useState } from "react";
import { Cpu, ShieldCheck, Terminal, CheckCircle2, Loader2, Wifi } from "lucide-react";
import { api } from "../../api/client";

interface BootLoaderProps {
  backendReady: boolean;
  briefingReady: boolean;
  onFinished: () => void;
}

const BOOT_PHASES = [
  "[SYS]  Mounting local neural kernel & SQLite memory core...",
  "[NET]  Binding WebSocket event bus & IPC channels...",
  "[SEC]  Verifying path-jailing & dual-channel auth matrix...",
  "[LLM]  Probing hardware profile & Ollama inference engine...",
  "[TTS]  Loading Natasha neural voice synthesizer...",
];

export const BootLoader: React.FC<BootLoaderProps> = ({
  backendReady,
  briefingReady,
  onFinished,
}) => {
  const [progress, setProgress] = useState(12);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [bootLines, setBootLines] = useState<string[]>([
    ">>> INITIALIZING E.D.I.T.H. CORE v0.1.0...",
    "[BOOT] Spawning local neural & desktop orchestration services...",
  ]);
  const [voiceReady, setVoiceReady] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subtle Matrix / Hex Cyber Rain Background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "01ABCDEF#$_<>/*";
    const fontSize = 13;
    const columns = Math.max(10, Math.floor(canvas.width / fontSize));
    const drops = Array.from({ length: columns }, () => Math.floor(Math.random() * -30));

    const draw = () => {
      ctx.fillStyle = "rgba(3, 7, 18, 0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0, 240, 255, 0.24)";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const id = setInterval(draw, 55);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Cycle hacker phase status while waiting for backend
  useEffect(() => {
    if (backendReady) return;
    const id = setInterval(() => {
      setPhaseIdx((p) => (p + 1) % BOOT_PHASES.length);
    }, 900);
    return () => clearInterval(id);
  }, [backendReady]);

  // Poll live backend boot logs
  useEffect(() => {
    let active = true;
    const pollLogs = async () => {
      try {
        const res = await api.getBootLogs(35);
        if (!active) return;
        if (res.logs && res.logs.length > 0) {
          setBootLines(res.logs);
        }
        if (res.voice_ready) setVoiceReady(true);
      } catch {
        // Backend still spinning up in parallel
      }
    };
    pollLogs();
    const id = setInterval(pollLogs, 280);
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
          return Math.min(100, prev + 16);
        }
        return Math.min(86, prev + 5);
      });
    }, 110);
    return () => clearInterval(timer);
  }, [backendReady, briefingReady]);

  useEffect(() => {
    if (progress >= 100 && backendReady) {
      const done = setTimeout(onFinished, 280);
      return () => clearTimeout(done);
    }
  }, [progress, backendReady, onFinished]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030712] text-slate-100 px-4 md:px-8 select-none overflow-hidden">
      {/* Matrix Hex Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-80" />

      {/* Subtle Scanline Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.12) 2px, rgba(0,240,255,0.12) 4px)",
        }}
      />

      {/* Foreground Hacker Boot Panel */}
      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">
        {/* Concentric Cyber Core */}
        <div className="relative flex items-center justify-center w-24 h-24 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-hudCyan/50 animate-[spin_7s_linear_infinite]" />
          <div className="absolute inset-2 rounded-full border border-emerald-400/50 animate-[spin_4s_linear_infinite_reverse]" />
          <div className="w-14 h-14 rounded-full bg-hudCyan/10 border-2 border-hudCyan flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.5)]">
            <Cpu className="w-7 h-7 text-hudCyan animate-pulse" />
          </div>
        </div>

        <div className="text-[11px] font-mono tracking-[0.35em] text-emerald-400 uppercase mb-1">
          &gt; INITIALIZING E.D.I.T.H. CORE
        </div>
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-[0.28em] text-slate-100 mb-1">
          E.D.I.T.H.
        </h1>
        <p className="text-[11px] font-mono text-hudCyan/80 tracking-wider mb-5">
          {backendReady ? "[ONLINE] Neural Kernel & Local Subsystems Armed" : BOOT_PHASES[phaseIdx]}
        </p>

        {/* Progress Bar + Status Matrix */}
        <div className="w-full space-y-3">
          <div className="w-full h-2 rounded-full bg-slate-900/90 border border-hudCyan/30 overflow-hidden shadow-[0_0_15px_rgba(0,240,255,0.15)]">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-hudCyan to-hudBlue transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-hudCyan/20">
              {backendReady ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-hudCyan animate-spin flex-shrink-0" />
              )}
              <span className="truncate">AI Core &amp; DB</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-hudCyan/20">
              {voiceReady ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-hudCyan animate-pulse flex-shrink-0" />
              )}
              <span className="truncate">Voice Engine</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-hudCyan/20">
              {briefingReady ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-hudCyan animate-spin flex-shrink-0" />
              )}
              <span className="truncate">MCP &amp; Briefing</span>
            </div>
          </div>

          {/* Hacker Terminal Stream */}
          <div className="rounded-2xl border border-hudCyan/30 bg-[#020611]/90 overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.12)]">
            <div className="px-3.5 py-2 border-b border-hudCyan/20 bg-slate-950/90 flex items-center justify-between text-[11px] font-mono text-hudCyan">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                root@edith-core:~# tail -f data/boot.log
              </span>
              <span className="text-emerald-400 font-semibold">{progress}%</span>
            </div>
            <div className="p-3.5 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 space-y-1 scrollbar-thin">
              {bootLines.map((ln, i) => (
                <div
                  key={i}
                  className={
                    ln.includes("ERROR") || ln.includes("WARNING")
                      ? "text-amber-300"
                      : ln.includes("ONLINE") || ln.includes("successfully") || ln.includes("complete")
                      ? "text-emerald-400"
                      : "text-cyan-100/85"
                  }
                >
                  {ln}
                </div>
              ))}
              <div className="text-emerald-400 animate-pulse">_</div>
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
