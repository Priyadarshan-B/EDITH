import React from "react";
import clsx from "clsx";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useVoiceStore } from "../../stores/voiceStore";

interface AudioOrbProps {
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}

export const AudioOrb: React.FC<AudioOrbProps> = ({ size = "md", interactive = true }) => {
  const { state, setState, wakeWordEnabled } = useVoiceStore();

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

  const getGlowStyles = () => {
    switch (state) {
      case "listening":
        return "border-hudCyan bg-hudCyan/20 shadow-[0_0_35px_rgba(0,240,255,0.7)] scale-105 animate-pulse";
      case "processing":
        return "border-hudBlue bg-hudBlue/20 shadow-[0_0_35px_rgba(0,114,255,0.7)] animate-spin";
      case "speaking":
        return "border-emerald-400 bg-emerald-500/20 shadow-[0_0_35px_rgba(52,211,153,0.7)] scale-110";
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
    <div className="relative flex items-center justify-center">
      {/* Outer Rotating Ring */}
      <div
        className={clsx(
          "absolute rounded-full border border-dashed border-hudCyan/30 transition-all duration-700",
          ringSizes[size],
          state === "listening" || state === "speaking" ? "animate-[spin_6s_linear_infinite]" : "opacity-30"
        )}
      />

      {/* Main Core Orb */}
      <button
        onClick={handleClick}
        disabled={!interactive}
        title={wakeWordEnabled ? "Wake word active: 'Hey EDITH'" : "Click to speak"}
        className={clsx(
          "relative flex items-center justify-center rounded-full border-2 transition-all duration-300 backdrop-blur-xl group cursor-pointer",
          sizeClasses[size],
          getGlowStyles()
        )}
      >
        {/* Core Icon / Arc Reactor pattern */}
        <div className="flex flex-col items-center justify-center">
          {state === "speaking" ? (
            <Volume2 className="w-8 h-8 text-emerald-300 animate-bounce" />
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
  );
};
