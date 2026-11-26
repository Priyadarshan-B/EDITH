import { create } from "zustand";
import { DetailedTelemetry, HardwareInfo, SystemTelemetry } from "../types";

interface SystemState {
  isConnected: boolean;
  cpuPercent: number;
  ramPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  detailed: DetailedTelemetry | null;
  hardware: HardwareInfo | null;
  activeModel: string;
  hardwareMode: string;
  operatorName: string;
  operatorTitle: string;
  setConnected: (connected: boolean) => void;
  setOperatorProfile: (name: string, title: string) => void;
  updateTelemetry: (telemetry: SystemTelemetry) => void;
  setDetailedTelemetry: (detailed: DetailedTelemetry) => void;
  setHardwareInfo: (info: HardwareInfo, activeModel: string) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  isConnected: false,
  cpuPercent: 0,
  ramPercent: 0,
  ramUsedGb: 0,
  ramTotalGb: 16,
  detailed: null,
  hardware: null,
  activeModel: "gemma4:e2b",
  hardwareMode: "auto (cpu)",
  operatorName: "BOSS",
  operatorTitle: "Boss",
  setConnected: (connected) => set({ isConnected: connected }),
  setOperatorProfile: (name, title) => set({ operatorName: name.toUpperCase(), operatorTitle: title }),
  updateTelemetry: (data) =>
    set({
      cpuPercent: data.cpu_percent,
      ramPercent: data.ram_percent,
      ramUsedGb: data.ram_used_gb,
      ramTotalGb: data.ram_total_gb,
    }),
  setDetailedTelemetry: (detailed) => set({ detailed }),
  setHardwareInfo: (hardware, activeModel) =>
    set({
      hardware,
      activeModel,
      hardwareMode: hardware.has_cuda ? `CUDA (${hardware.device_name})` : "CPU (int8)",
    }),
}));

