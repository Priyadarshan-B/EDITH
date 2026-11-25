import React, { useEffect, useState } from "react";
import { MousePointer2, Sliders, X, Hand, Eye, EyeOff } from "lucide-react";
import { api, VirtualMouseStatus } from "../../api/client";

interface VirtualMousePanelProps {
  isOpen: boolean;
  onClose: () => void;
  status: VirtualMouseStatus | null;
  onStatusChange: (status: VirtualMouseStatus) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

export const VirtualMousePanel: React.FC<VirtualMousePanelProps> = ({
  isOpen,
  onClose,
  status,
  onStatusChange,
  showPreview,
  onTogglePreview,
}) => {
  const [localCfg, setLocalCfg] = useState({
    camera_index: status?.camera_index ?? 0,
    sensitivity: status?.sensitivity ?? 1.25,
    smoothing: status?.smoothing ?? 0.35,
    deadzone: status?.deadzone ?? 4,
    scroll_speed: status?.scroll_speed ?? 1.0,
    drag_enabled: status?.drag_enabled ?? true,
    mirror: status?.mirror ?? true,
  });

  const [cameras, setCameras] = useState<{ index: number; label: string }[]>([]);

  useEffect(() => {
    if (isOpen && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devs) => {
          const vids = devs
            .filter((d) => d.kind === "videoinput")
            .map((d, idx) => ({
              index: idx,
              label: d.label || `Camera ${idx + 1}`,
            }));
          setCameras(vids);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (status) {
      setLocalCfg({
        camera_index: status.camera_index,
        sensitivity: status.sensitivity,
        smoothing: status.smoothing ?? 0.35,
        deadzone: status.deadzone ?? 4,
        scroll_speed: status.scroll_speed ?? 1.0,
        drag_enabled: status.drag_enabled ?? true,
        mirror: status.mirror ?? true,
      });
    }
  }, [status]);

  if (!isOpen) return null;

  const updateField = async (patch: Partial<typeof localCfg>) => {
    const next = { ...localCfg, ...patch };
    setLocalCfg(next);
    try {
      const updated = await api.configureVirtualMouse(patch);
      onStatusChange(updated);
    } catch (e) {
      console.error("Failed to update virtual mouse config:", e);
    }
  };

  const toggleEnabled = async () => {
    try {
      const next = !(status?.enabled ?? false);
      const updated = await api.toggleVirtualMouse(next, localCfg.camera_index, localCfg.sensitivity);
      onStatusChange(updated);
      if (updated.last_error) {
        alert(`Virtual Mouse Error: ${updated.last_error}`);
      }
    } catch (e) {
      console.error("Toggle error:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-hudCyan/40 bg-slate-950/95 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <MousePointer2 className="w-5 h-5 text-hudCyan" />
            <div>
              <h3 className="text-sm font-mono font-bold text-slate-100">
                Global Camera Virtual Mouse
              </h3>
              <p className="text-[11px] text-slate-400">
                Works across the entire Windows desktop background (DPI-aware Win32).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto scrollbar-thin">
          {/* Status & Master Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-slate-900/60">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">State:</span>
                <span className={status?.enabled ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                  {status?.enabled ? "ACTIVE GLOBALLY" : "OFF"}
                </span>
                {status?.enabled && (
                  <span className="px-2 py-0.5 rounded bg-hudCyan/15 text-hudCyan text-[10px]">
                    {status.gesture}
                  </span>
                )}
              </div>
              {status?.last_error && (
                <div className="text-[11px] font-mono text-rose-400">{status.last_error}</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {status?.enabled && (
                <button
                  onClick={onTogglePreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-mono text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPreview ? "Hide Cam" : "Show Cam"}</span>
                </button>
              )}
              <button
                onClick={toggleEnabled}
                className={`px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  status?.enabled
                    ? "bg-rose-500/20 border border-rose-500/60 text-rose-300 hover:bg-rose-500/30"
                    : "bg-hudCyan text-slate-950 hover:bg-cyan-300"
                }`}
              >
                {status?.enabled ? "Stop Virtual Mouse" : "Start Virtual Mouse"}
              </button>
            </div>
          </div>

          {status?.enabled && (
            <div className="px-3.5 py-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-[11px] font-mono text-emerald-300">
              Live WebRTC + MediaPipe JS camera stream is running in the bottom-right preview widget and controlling your global Windows cursor.
            </div>
          )}

          {/* Controls */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-hudCyan" />
              <span>Tracking &amp; Gesture Options</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <label className="p-3 rounded-xl bg-slate-900/50 border border-border/70 space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Sensitivity</span>
                  <span className="text-hudCyan">{localCfg.sensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={localCfg.sensitivity}
                  onChange={(e) => updateField({ sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-xl bg-slate-900/50 border border-border/70 space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Responsiveness</span>
                  <span className="text-hudCyan">{Math.round(localCfg.smoothing * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={localCfg.smoothing}
                  onChange={(e) => updateField({ smoothing: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-xl bg-slate-900/50 border border-border/70 space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Anti-Jitter Deadzone</span>
                  <span className="text-hudCyan">{localCfg.deadzone.toFixed(0)} px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={localCfg.deadzone}
                  onChange={(e) => updateField({ deadzone: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-xl bg-slate-900/50 border border-border/70 space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Scroll Speed</span>
                  <span className="text-hudCyan">{localCfg.scroll_speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={3.0}
                  step={0.1}
                  value={localCfg.scroll_speed}
                  onChange={(e) => updateField({ scroll_speed: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-xl bg-slate-900/50 border border-border/70 flex items-center justify-between">
                <span className="text-slate-300">Camera Index</span>
                <select
                  value={localCfg.camera_index}
                  onChange={(e) => updateField({ camera_index: parseInt(e.target.value, 10) })}
                  className="px-2 py-1 rounded bg-slate-950 border border-border text-hudCyan max-w-[160px] truncate"
                >
                  {(cameras.length > 0 ? cameras : [0, 1, 2, 3].map((i) => ({ index: i, label: `Camera ${i}` }))).map((cam) => (
                    <option key={cam.index} value={cam.index}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-border/70 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localCfg.drag_enabled}
                    onChange={(e) => updateField({ drag_enabled: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Pinch Drag</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localCfg.mirror}
                    onChange={(e) => updateField({ mirror: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>Mirror</span>
                </label>
              </div>
            </div>
          </div>

          {/* Gesture Guide */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-border/70 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-300">
              <Hand className="w-3.5 h-3.5 text-hudCyan" />
              <span>Hand Gesture Controls</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
              <div><span className="text-hudCyan">Index Up:</span> Move Cursor</div>
              <div><span className="text-hudCyan">Thumb + Index Tap:</span> Left Click</div>
              <div><span className="text-hudCyan">Thumb + Index Hold:</span> Drag &amp; Drop</div>
              <div><span className="text-hudCyan">Thumb + Middle Pinch:</span> Right Click</div>
              <div><span className="text-hudCyan">Thumb + Ring Pinch:</span> Double Click</div>
              <div><span className="text-hudCyan">Index + Middle Up:</span> Vertical / Horiz Scroll</div>
              <div className="sm:col-span-2"><span className="text-amber-300">Closed Fist or Open Palm (5 fingers):</span> Pause Cursor</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
