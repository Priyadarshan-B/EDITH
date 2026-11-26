import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu, Sparkles, Check } from "lucide-react";
import { api, AvailableModelsResponse } from "../../api/client";
import { useSystemStore } from "../../stores/systemStore";
import { useChatStore } from "../../stores/chatStore";

export const ModelSelector: React.FC = () => {
  const { hardwareMode } = useSystemStore();
  const { activeModel, setActiveModel } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [modelsData, setModelsData] = useState<AvailableModelsResponse | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const data = await api.getModels();
        setModelsData(data);
        setActiveModel(data.active_model);
      } catch (e) {
        console.warn("Could not fetch models:", e);
      }
    };
    loadModels();
  }, [setActiveModel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectModel = async (modelName: string, provider?: string) => {
    setIsSwitching(true);
    try {
      await api.switchModel(modelName, provider);
      setActiveModel(modelName);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to switch model:", e);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Model Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-hudCyan/40 bg-card/80 hover:bg-card hover:border-hudCyan transition-all backdrop-blur-md text-xs font-mono text-slate-200 cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.15)]"
      >
        <div className="w-2 h-2 rounded-full bg-hudCyan shadow-[0_0_6px_#00f0ff] animate-pulse" />
        <span className="text-slate-400 text-[10px] uppercase">MODEL:</span>
        <span className="font-semibold text-hudCyan">{activeModel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Futuristic Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-card/95 border border-hudCyan/50 rounded-2xl shadow-hudStrong p-4 z-50 backdrop-blur-2xl">
          <div className="flex items-center justify-between pb-2.5 border-b border-border/80 mb-3">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">AI Inference Engine</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-hudCyan/30 bg-hudCyan/10 text-hudCyan">
              {hardwareMode}
            </span>
          </div>

          {/* Local Fast Models */}
          <div className="mb-3">
            <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-hudCyan" /> Local Models (Ollama)
            </div>
            <div className="space-y-1">
              {modelsData?.suggested_local_models.map((m) => {
                const isSelected = activeModel === m.name;
                return (
                  <button
                    key={m.name}
                    disabled={isSwitching}
                    onClick={() => handleSelectModel(m.name, "ollama")}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                      isSelected
                        ? "bg-hudCyan/20 text-hudCyan border border-hudCyan/40 shadow-hud"
                        : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                    }`}
                  >
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.installed && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            PULLED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">{m.description}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-hudCyan flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cloud Fallback Models */}
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-hudOrange" /> Cloud Intelligence
            </div>
            <div className="space-y-1">
              {modelsData?.cloud_models.map((m) => {
                const isSelected = activeModel === m.name;
                return (
                  <button
                    key={m.name}
                    disabled={isSwitching}
                    onClick={() => handleSelectModel(m.name, m.provider || "gemini")}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                      isSelected
                        ? "bg-hudOrange/20 text-hudOrange border border-hudOrange/40 shadow-[0_0_10px_rgba(255,145,0,0.3)]"
                        : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{m.description}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-hudOrange flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border/60 text-[10px] font-mono text-slate-500 text-center">
            Zero cloud telemetry unless Cloud model is explicitly selected
          </div>
        </div>
      )}
    </div>
  );
};
