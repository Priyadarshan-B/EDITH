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
  Cloud,
  HardDrive,
  Terminal,
} from "lucide-react";
import { api } from "../../api/client";

interface TrainingLog {
  id: string;
  title: string;
  details: string;
  category: string;
  timestamp: string;
}

interface CommandPattern {
  id: string;
  prompt: string;
  intent_or_tool: string;
  source_mode: string;
  model_used: string;
  learned_summary: string;
  confidence: number;
  timestamp: string;
}

interface HowStep {
  step: string;
  detail: string;
}

export const ContinuousLearningCard: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [totalPairs, setTotalPairs] = useState(0);
  const [lastTrained, setLastTrained] = useState<string | null>(null);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [patterns, setPatterns] = useState<CommandPattern[]>([]);
  const [stats, setStats] = useState({ total_patterns: 0, offline_count: 0, online_count: 0, tool_count: 0 });
  const [howItLearns, setHowItLearns] = useState<HowStep[]>([]);
  const [patternFilter, setPatternFilter] = useState<"all" | "online_cloud" | "offline_local" | "desktop_tool">("all");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await api.getTrainingStatus();
      setEnabled(data.enabled);
      setTotalPairs(data.total_pairs);
      setLastTrained(data.last_trained_at);
      setLogs(data.logs || []);
      setPatterns(data.patterns || []);
      if (data.stats) setStats(data.stats);
      if (data.how_it_learns) setHowItLearns(data.how_it_learns);
    } catch (e) {
      console.error("Failed to load continuous learning status:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
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

  const filteredPatterns = patterns.filter(
    (p) => patternFilter === "all" || p.source_mode === patternFilter
  );

  return (
    <div className="border border-cyan-400/30 rounded-2xl bg-slate-950/45 backdrop-blur-xl overflow-hidden shadow-hud mb-6 transition-all">
      {/* Header with Switch and Status */}
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40 border-b border-cyan-400/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hudCyan/10 border border-hudCyan/40 flex items-center justify-center text-hudCyan shadow-hud">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold tracking-wider text-slate-100 font-display">
                Offline &amp; Online Continuous Learning Engine
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                  enabled
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}
              >
                {enabled ? "LEARNING EVERY COMMAND" : "PAUSED"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Captures every command &amp; fuses knowledge from both Offline Local (Qwen/Ollama) and Online Cloud (Groq/Gemini) LLMs.
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-border/60">
            <span className="text-[11px] font-mono text-slate-400">
              {enabled ? "Auto Learn" : "Paused"}
            </span>
            <button
              onClick={handleToggle}
              role="switch"
              aria-checked={enabled}
              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                enabled ? "bg-hudCyan shadow-[0_0_8px_rgba(0,240,255,0.5)]" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 transition duration-200 ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleRunNow}
            disabled={isRefreshing || !enabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-hudCyan/20 hover:bg-hudCyan/30 border border-hudCyan/40 text-hudCyan text-xs font-mono transition-all disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Compile Local Model</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-border/60 text-slate-300 hover:text-hudCyan text-xs font-mono cursor-pointer"
          >
            <span>{isCollapsed ? "Expand" : "Hide"}</span>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Metrics Snapshot Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-slate-950/25 text-xs font-mono border-b border-cyan-400/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-hudCyan" />
          <span className="text-slate-400">Dataset Pairs:</span>
          <span className="text-slate-100 font-bold">{totalPairs}</span>
        </div>
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-sky-400" />
          <span className="text-slate-400">Online Knowledge:</span>
          <span className="text-sky-300 font-bold">{stats.online_count}</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-purple-400" />
          <span className="text-slate-400">Offline Local:</span>
          <span className="text-purple-300 font-bold">{stats.offline_count}</span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Desktop Tools:</span>
          <span className="text-emerald-300 font-bold">{stats.tool_count}</span>
        </div>
        <div className="flex items-center gap-2 col-span-2 lg:col-span-1">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400">Synced:</span>
          <span className="text-slate-200 truncate">{lastTrained || "Live"}</span>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 bg-slate-950/35 space-y-5">
          {/* How EDITH Learns Pipeline */}
          {howItLearns.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-slate-300">
                <BookOpen className="w-3.5 h-3.5 text-hudCyan" />
                <span>How EDITH Learns (Offline + Online Fusion)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {howItLearns.map((h) => (
                  <div
                    key={h.step}
                    className="p-3 rounded-xl bg-slate-900/60 border border-cyan-400/15 space-y-1"
                  >
                    <div className="text-xs font-mono font-semibold text-hudCyan">{h.step}</div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">{h.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What EDITH Is Learning (Live Command & Knowledge Patterns) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border/30">
              <span className="text-xs font-mono tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-hudCyan" />
                What EDITH Is Learning ({filteredPatterns.length} Patterns)
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                {[
                  { id: "all", label: "All" },
                  { id: "online_cloud", label: "Online LLM" },
                  { id: "offline_local", label: "Offline LLM" },
                  { id: "desktop_tool", label: "Commands" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPatternFilter(tab.id as any)}
                    className={`px-2 py-0.5 rounded-lg border cursor-pointer ${
                      patternFilter === tab.id
                        ? "border-hudCyan/60 bg-hudCyan/15 text-hudCyan"
                        : "border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
              {filteredPatterns.length === 0 ? (
                <p className="text-xs font-mono text-slate-500 py-3 text-center">
                  Send a command or ask a news/general question—EDITH will display every learned pattern here.
                </p>
              ) : (
                filteredPatterns.slice(0, 25).map((pat) => (
                  <div
                    key={pat.id}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-hudCyan/30 transition-all text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-slate-100 font-semibold truncate max-w-md">
                        &quot;{pat.prompt}&quot;
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            pat.source_mode === "online_cloud"
                              ? "bg-sky-500/15 text-sky-300"
                              : pat.source_mode === "offline_local"
                              ? "bg-purple-500/15 text-purple-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {pat.source_mode} • {pat.model_used}
                        </span>
                        <span className="text-[10px] text-slate-500">{pat.timestamp}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      <span className="text-hudCyan">[{pat.intent_or_tool}]</span> {pat.learned_summary}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Milestones Timeline */}
          <div className="space-y-2">
            <span className="text-xs font-mono tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Recent Learning Milestones ({logs.length})
            </span>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
              {logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/70 flex items-start justify-between gap-3 text-xs font-mono"
                >
                  <div>
                    <div className="font-semibold text-slate-200">{log.title}</div>
                    <p className="text-slate-400 text-[11px]">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
