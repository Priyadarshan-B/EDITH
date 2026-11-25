import React, { useEffect, useState } from "react";
import { Cpu, HardDrive, MemoryStick, Zap, RefreshCw, Volume2, Play, Smartphone } from "lucide-react";
import { useSystemStore } from "../../stores/systemStore";
import { useVoiceStore } from "../../stores/voiceStore";
import { api, VoicePackInfo } from "../../api/client";
import { getApiBase, setApiBase } from "../../api/config";
import { wsClient } from "../../api/ws";
import { speakText } from "../../utils/speech";

export const SystemTab: React.FC = () => {
  const { detailed, setDetailedTelemetry, hardware, hardwareMode } = useSystemStore();
  const { voicePack, voiceRate, setVoicePack, setVoiceRate } = useVoiceStore();
  const [loading, setLoading] = useState(false);
  const [voicePacks, setVoicePacks] = useState<VoicePackInfo[]>([]);
  const [serverUrlInput, setServerUrlInput] = useState(getApiBase());
  const [mobileLanUrl, setMobileLanUrl] = useState<string | null>(null);

  const fetchDetailed = async () => {
    setLoading(true);
    try {
      const data = await api.getTelemetry();
      setDetailedTelemetry(data);
    } catch (e) {
      console.error("Failed to load detailed telemetry:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailed();
    api.getVoicePacks()
      .then((res) => setVoicePacks(res.packs))
      .catch(() => {});
    api.getNetworkInfo()
      .then((net) => setMobileLanUrl(net.mobile_url))
      .catch(() => {});
    const interval = setInterval(fetchDetailed, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectVoice = async (id: string) => {
    setVoicePack(id);
    try {
      await api.updateVoiceSettings(id, voiceRate);
    } catch (e) {
      console.error("Failed to update voice pack:", e);
    }
  };

  const handleRateChange = async (newRate: number) => {
    setVoiceRate(newRate);
    try {
      await api.updateVoiceSettings(voicePack, newRate);
    } catch (e) {
      console.error("Failed to update voice rate:", e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full p-6 select-none overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-hudCyan/10 border border-hudCyan flex items-center justify-center text-hudCyan shadow-hud">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-slate-100">
              System Hardware & Telemetry
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Real-time resource allocation and hardware diagnostics.
            </p>
          </div>
        </div>

        <button
          onClick={fetchDetailed}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-slate-800 text-xs font-mono text-slate-300 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* CPU Summary */}
        <div className="p-4 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-hudCyan" /> CPU Load
            </span>
            <span className="font-semibold text-hudCyan">
              {detailed?.cpu.total_percent.toFixed(1) || 0}%
            </span>
          </div>
          <div className="text-xs font-mono text-slate-300">
            {detailed?.cpu.cores_physical} Cores / {detailed?.cpu.threads_logical} Threads
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Freq: {detailed?.cpu.frequency_mhz} MHz
          </div>
        </div>

        {/* Memory Summary */}
        <div className="p-4 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <MemoryStick className="w-4 h-4 text-hudCyan" /> Memory
            </span>
            <span className="font-semibold text-hudCyan">
              {detailed?.memory.percent.toFixed(0) || 0}%
            </span>
          </div>
          <div className="text-xs font-mono text-slate-300">
            {detailed?.memory.used_gb} / {detailed?.memory.total_gb} GB
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Free: {detailed?.memory.available_gb} GB
          </div>
        </div>

        {/* Storage Summary */}
        <div className="p-4 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-hudCyan" /> Storage
            </span>
            <span className="font-semibold text-hudCyan">
              {detailed?.disk.percent || 0}%
            </span>
          </div>
          <div className="text-xs font-mono text-slate-300">
            {detailed?.disk.free_gb} GB Free
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Total: {detailed?.disk.total_gb} GB
          </div>
        </div>

        {/* Compute Engine */}
        <div className="p-4 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-hudCyan" /> Compute Mode
            </span>
            <span className="font-semibold text-emerald-400">ONLINE</span>
          </div>
          <div className="text-xs font-mono text-slate-200 truncate">
            {hardwareMode}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            Device: {hardware?.device_name || "CPU"}
          </div>
        </div>
      </div>

      {/* Per-Core CPU Meters */}
      {detailed?.cpu?.per_cpu_percent && (
        <div className="p-5 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md mb-6">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-4">
            Logical Core Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {detailed.cpu.per_cpu_percent.map((pct, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Thread #{idx}</span>
                  <span className="text-slate-200">{pct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-hudCyan transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Female English Voice Pack Selector */}
      <div className="p-5 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-hudCyan" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-200">
                Neural Female English Voice Pack
              </h3>
              <p className="text-[11px] text-slate-400">
                Select EDITH&apos;s spoken voice accent and speaking speed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <span>Speed: {voiceRate.toFixed(2)}x</span>
              <input
                type="range"
                min={0.75}
                max={1.25}
                step={0.05}
                value={voiceRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="accent-cyan-400 cursor-pointer"
              />
            </label>
            <button
              onClick={() =>
                speakText("All systems online. EDITH neural voice pack is ready, Boss.")
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-hudCyan/50 bg-hudCyan/10 hover:bg-hudCyan/20 text-xs font-mono text-hudCyan transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Test Voice</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {voicePacks.map((pack) => {
            const active = voicePack === pack.id;
            return (
              <button
                key={pack.id}
                onClick={() => handleSelectVoice(pack.id)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  active
                    ? "border-hudCyan bg-hudCyan/10 shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                    : "border-border/80 bg-slate-900/50 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-semibold text-slate-100">
                    {pack.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-hudCyan">
                    {pack.locale}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{pack.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile & LAN Companion Connection */}
      <div className="mt-6 p-5 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md space-y-3">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-4 h-4 text-hudCyan" />
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-200">
              Mobile App &amp; LAN Connection
            </h3>
            <p className="text-[11px] text-slate-400">
              Open EDITH on your phone browser or Capacitor Android app on the same Wi-Fi.
              {mobileLanUrl && (
                <>
                  {" "}
                  LAN URL: <span className="font-mono text-hudCyan">{mobileLanUrl}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
            placeholder="http://192.168.1.x:18425"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950/70 border border-border/80 text-xs font-mono text-slate-100 focus:outline-none focus:border-hudCyan"
          />
          <button
            onClick={() => {
              setApiBase(serverUrlInput);
              wsClient.refreshUrl();
              fetchDetailed();
            }}
            className="px-4 py-2 rounded-xl border border-hudCyan/50 bg-hudCyan/10 hover:bg-hudCyan/20 text-xs font-mono text-hudCyan cursor-pointer"
          >
            Save &amp; Reconnect
          </button>
        </div>
      </div>
    </div>
  );
};
