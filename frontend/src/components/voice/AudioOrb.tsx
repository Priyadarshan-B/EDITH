import React from "react";
import clsx from "clsx";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useVoiceStore } from "../../stores/voiceStore";

interface AudioOrbProps {
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}

const BAR_WEIGHTS = [0.35, 0.65, 0.9, 1.0, 0.75, 1.0, 0.85, 0.6, 0.35];

export const AudioOrb: React.FC<AudioOrbProps> = ({ size = "md", interactive = true }) => {
  const { state, setState, wakeWordEnabled, audioLevel } = useVoiceStore();

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-28 h-28",
    lg: "w-40 h-40",
  };

  const ringSizes = {
    sm: "w-20 h-20",
    md: "w-36 h-36",
    lg: "w-52 h-52",
  };

  const activeWave = state === "listening" || state === "speaking";
  const normLevel = Math.max(0.05, Math.min(1, audioLevel / 100));
  const dynamicScale = activeWave ? 1 + normLevel * 0.12 : 1;

  const getGlowStyles = () => {
    switch (state) {
      case "listening":
        return "border-hudCyan bg-hudCyan/20 shadow-[0_0_35px_rgba(0,240,255,0.7)]";
      case "processing":
        return "border-hudBlue bg-hudBlue/20 shadow-[0_0_35px_rgba(0,114,255,0.7)] animate-pulse";
      case "speaking":
        return "border-emerald-400 bg-emerald-500/20 shadow-[0_0_38px_rgba(52,211,153,0.75)]";
      case "muted":
      case "disabled":
        return "border-slate-700 bg-slate-900/60 shadow-none opacity-60";
      default:
        return "border-hudCyan/50 bg-hudCyan/5 shadow-[0_0_20px_rgba(0,240,255,0.3)]";
    }
  };

  const handleClick = () => {
    if (!interactive) return;
    if (state === "idle") {
      setState("listening");
    } else if (state === "listening") {
      setState("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        {/* Outer Audio-Reactive Waveform Ring (for both Bot & User) */}
        {activeWave && (
          <div
            className={clsx(
              "absolute rounded-full border-2 transition-transform duration-75 ease-out pointer-events-none",
              state === "speaking" ? "border-emerald-400/50" : "border-hudCyan/50"
            )}
            style={{
              width: size === "sm" ? "88px" : size === "md" ? "156px" : "228px",
              height: size === "sm" ? "88px" : size === "md" ? "156px" : "228px",
              transform: `scale(${1 + normLevel * 0.35})`,
              opacity: 0.35 + normLevel * 0.65,
            }}
          />
        )}

        {/* Rotating Ring Pattern */}
        <div
          className={clsx(
            "absolute rounded-full border border-dashed transition-all duration-700",
            ringSizes[size],
            state === "speaking" ? "border-emerald-400/40" : "border-hudCyan/30",
            activeWave ? "animate-[spin_6s_linear_infinite]" : "opacity-30"
          )}
        />

        {/* Main Core Reactor Orb */}
        <button
          onClick={handleClick}
          disabled={!interactive}
          title={wakeWordEnabled ? "Wake word active: 'Hey EDITH'" : "Click to speak"}
          style={{ transform: `scale(${dynamicScale})` }}
          className={clsx(
            "relative flex items-center justify-center rounded-full border-2 transition-all duration-100 backdrop-blur-xl group cursor-pointer",
            sizeClasses[size],
            getGlowStyles()
          )}
        >
          <div className="flex flex-col items-center justify-center">
            {state === "speaking" ? (
              <Volume2 className="w-8 h-8 text-emerald-300" />
            ) : state === "muted" || state === "disabled" ? (
              <MicOff className="w-8 h-8 text-slate-500" />
            ) : (
              <Mic className="w-8 h-8 text-hudCyan group-hover:scale-110 transition-transform" />
            )}

            {size !== "sm" && (
              <span className="text-[10px] font-mono tracking-widest mt-1 text-slate-300 uppercase">
                {state}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Synced Multi-Bar Holographic Audio Equalizer (Bot & User) */}
      {size !== "sm" && (
        <div className="flex items-center justify-center gap-1 h-7 px-3">
          {BAR_WEIGHTS.map((w, i) => {
            const heightPx = activeWave
              ? Math.max(4, Math.round(6 + normLevel * w * 22))
              : 4;
            return (
              <span
                key={i}
                style={{ height: `${heightPx}px` }}
                className={clsx(
                  "w-1 rounded-full transition-all duration-75",
                  state === "speaking"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                    : state === "listening"
                    ? "bg-hudCyan shadow-[0_0_8px_rgba(0,240,255,0.7)]"
                    : "bg-slate-700"
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
