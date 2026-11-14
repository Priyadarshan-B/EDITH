export type WindowMode = "main" | "spotlight";

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "muted" | "disabled";

export interface HardwareInfo {
  device_name: string;
  has_cuda: boolean;
  vram_mb: number;
  total_ram_gb: number;
  available_ram_gb: number;
  cpu_cores_physical: number;
  cpu_threads_logical: number;
  ollama_available: boolean;
  recommended_profile: "cuda_accelerated" | "cpu_efficient";
  recommended_model: string;
  whisper_device: "cuda" | "cpu";
  whisper_compute: "float16" | "int8";
}

export interface SystemTelemetry {
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
}

export interface DetailedTelemetry {
  cpu: {
    total_percent: number;
    per_cpu_percent: number[];
    cores_physical: number;
    threads_logical: number;
    frequency_mhz: number;
  };
  memory: {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    percent: number;
  };
  disk: {
    total_gb: number;
    free_gb: number;
    used_gb: number;
    percent: number;
  };
  battery: {
    has_battery: boolean;
    percent: number;
    power_plugged: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  modelUsed?: string;
  isStreaming?: boolean;
}

export interface HealthResponse {
  status: string;
  name: string;
  version: string;
  environment: string;
  hardware: HardwareInfo;
  models: {
    primary_provider: string;
    routing_model: string;
    complex_model: string;
  };
}
