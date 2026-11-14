import React, { useState, useEffect } from "react";
import {
  Cpu,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Clock,
  Zap,
  BookOpen,
} from "lucide-react";
import { api } from "../../api/client";

interface TrainingLog {
  id: string;
  title: string;
  details: string;
  category: string;
  timestamp: string;
}

export const ContinuousLearningCard: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [totalPairs, setTotalPairs] = useState(0);
  const [lastTrained, setLastTrained] = useState<string | null>(null);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await api.getTrainingStatus();
      setEnabled(data.enabled);
      setTotalPairs(data.total_pairs);
      setLastTrained(data.last_trained_at);
      setLogs(data.logs || []);
    } catch (e) {
      console.error("Failed to load continuous learning status:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    try {
      const res = await api.toggleContinuousTraining(!enabled);
      setEnabled(res.enabled);
      await fetchStatus();
    } catch (e) {
      console.error("Failed to toggle continuous learning:", e);
    }
  };

  const handleRunNow = async () => {
    setIsRefreshing(true);
    try {
      await api.runPersonalizationNow();
      await fetchStatus();
    } catch (e) {
      console.error("Failed to execute training cycle:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="border border-hudCyan/30 rounded-xl bg-card/60 backdrop-blur-md overflow-hidden shadow-[0_0_15px_rgba(0,240,255,0.08)] mb-6 transition-all">
      {/* Header with Switch and Status */}
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hudCyan/10 border border-hudCyan/40 flex items-center justify-center text-hudCyan shadow-[0_0_12px_rgba(0,240,255,0.2)]">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wider text-slate-100 font-mono">
                Continuous Personalization & Offline Model Learner
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                  enabled
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}
              >
                {enabled ? "ACTIVE (AUTO)" : "PAUSED"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuously compiles your searches, commands, and preferences to fine-tune offline local AI intelligence.
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* On/Off Switch */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-border/60">
            <span className="text-[11px] font-mono text-slate-400">
              {enabled ? "Personalize" : "Paused"}
            </span>
            <button
              onClick={handleToggle}
              role="switch"
              aria-checked={enabled}
              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? "bg-hudCyan shadow-[0_0_8px_rgba(0,240,255,0.5)]" : "bg-slate-700"
              }`}
              title={enabled ? "Click to Pause Continuous Learning" : "Click to Enable Continuous Learning"}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Trigger Cycle Button */}
          <button
            onClick={handleRunNow}
            disabled={isRefreshing || !enabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-hudCyan/20 hover:bg-hudCyan/30 border border-hudCyan/40 text-hudCyan text-xs font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.15)] active:scale-95"
            title="Compile Today's Interaction Dataset & Update Modelfile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Sync Dataset</span>
          </button>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-border/60 text-slate-300 hover:text-hudCyan text-xs font-mono transition-colors cursor-pointer"
            title={isCollapsed ? "Expand Human-Readable Learning Logs" : "Collapse Logs"}
          >
            <span>Logs</span>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Metrics Snapshot Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-950/20 text-xs font-mono border-b border-border/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-hudCyan" />
          <span className="text-slate-400">Curated Pairs:</span>
          <span className="text-slate-100 font-bold">{totalPairs} interactions</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Last Synced:</span>
          <span className="text-slate-100">{lastTrained || "Pending first cycle"}</span>
        </div>
        <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
          <BookOpen className="w-4 h-4 text-hudBlue" />
          <span className="text-slate-400">Target:</span>
          <span className="text-slate-100">Ollama Qwen2.5 (Local)</span>
        </div>
      </div>

      {/* Collapsible Human-Readable Logs Section */}
      {!isCollapsed && (
        <div className="p-4 bg-slate-950/50 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1 border-b border-border/30">
            <span className="text-xs font-mono tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-hudCyan" />
              Human-Readable Learning Logs
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Showing {logs.length} observed milestones
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-3 text-center">
                No learning events recorded yet. Start interacting with EDITH to build your personal dataset.
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-slate-900/70 border border-slate-800/80 hover:border-hudCyan/30 transition-all flex items-start justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-hudCyan shrink-0 mt-0.5" />
                      <span className="font-semibold text-slate-200">{log.title}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] pl-5 leading-relaxed">
                      {log.details}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">
                    {log.timestamp}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
