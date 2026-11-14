import React from "react";
import { Cpu, HardDrive, MemoryStick, Zap } from "lucide-react";
import { useSystemStore } from "../../stores/systemStore";

export const TelemetryCard: React.FC = () => {
  const { cpuPercent, ramPercent, ramUsedGb, ramTotalGb, detailed } = useSystemStore();

  const getMeterColor = (percent: number) => {
    if (percent > 85) return "bg-hudRed shadow-[0_0_8px_#ff2a55]";
    if (percent > 65) return "bg-hudOrange shadow-[0_0_8px_#ff9100]";
    return "bg-hudCyan shadow-[0_0_8px_#00f0ff]";
  };

  return (
    <div className="bg-card/70 border border-border/80 backdrop-blur-md rounded-xl p-4 shadow-hud">
      <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400">System Telemetry</span>
        <div className="flex items-center gap-1 text-[11px] font-mono text-hudCyan">
          <Zap className="w-3.5 h-3.5" />
          <span>LIVE</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* CPU */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-1">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-hudCyan" /> CPU Load
            </span>
            <span className="font-semibold text-slate-200">{cpuPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getMeterColor(cpuPercent)}`}
              style={{ width: `${Math.min(cpuPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-1">
            <span className="flex items-center gap-1.5 text-slate-300">
              <MemoryStick className="w-3.5 h-3.5 text-hudCyan" /> Memory
            </span>
            <span className="font-semibold text-slate-200">
              {ramUsedGb.toFixed(1)} / {ramTotalGb.toFixed(0)} GB ({ramPercent.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getMeterColor(ramPercent)}`}
              style={{ width: `${Math.min(ramPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        {detailed?.disk && (
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="flex items-center gap-1.5 text-slate-300">
                <HardDrive className="w-3.5 h-3.5 text-hudCyan" /> Storage
              </span>
              <span className="font-semibold text-slate-200">
                {detailed.disk.free_gb.toFixed(0)} GB Free ({detailed.disk.percent}%)
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getMeterColor(detailed.disk.percent)}`}
                style={{ width: `${Math.min(detailed.disk.percent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

