import React from "react";
import clsx from "clsx";

interface StatusPillProps {
  label: string;
  value: string;
  status?: "active" | "warning" | "danger" | "offline";
  icon?: React.ReactNode;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  value,
  status = "active",
  icon,
}) => {
  const statusColors = {
    active: "border-hudCyan/40 text-hudCyan bg-hudCyan/10 shadow-[0_0_8px_rgba(0,240,255,0.2)]",
    warning: "border-hudOrange/40 text-hudOrange bg-hudOrange/10 shadow-[0_0_8px_rgba(255,145,0,0.2)]",
    danger: "border-hudRed/40 text-hudRed bg-hudRed/10 shadow-[0_0_8px_rgba(255,42,85,0.2)]",
    offline: "border-slate-700 text-slate-400 bg-slate-800/40",
  };

  const indicatorDot = {
    active: "bg-hudCyan shadow-[0_0_6px_#00f0ff]",
    warning: "bg-hudOrange shadow-[0_0_6px_#ff9100]",
    danger: "bg-hudRed shadow-[0_0_6px_#ff2a55]",
    offline: "bg-slate-500",
  };

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono transition-all backdrop-blur-md",
        statusColors[status]
      )}
    >
      <div className={clsx("w-2 h-2 rounded-full", indicatorDot[status])} />
      {icon}
      <span className="text-slate-400 uppercase text-[10px] tracking-wider">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
};
