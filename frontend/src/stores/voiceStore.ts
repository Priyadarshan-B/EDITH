import { create } from "zustand";
import { VoiceState } from "../types";

interface VoiceStoreState {
  state: VoiceState;
  wakeWordEnabled: boolean;
  ttsEnabled: boolean;
  audioLevel: number;
  lastTranscript: string;
  voicePack: string;
  voiceRate: number;
  setState: (state: VoiceState) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setAudioLevel: (level: number) => void;
  setLastTranscript: (text: string) => void;
  setVoicePack: (voicePack: string) => void;
  setVoiceRate: (voiceRate: number) => void;
}

const savedVoicePack =
  (typeof window !== "undefined" && localStorage.getItem("edith_voice_pack")) ||
  "en-GB-SoniaNeural";
const savedVoiceRate =
  (typeof window !== "undefined" && parseFloat(localStorage.getItem("edith_voice_rate") || "1.0")) ||
  1.0;

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  state: "idle",
  wakeWordEnabled: true,
  ttsEnabled: true,
  audioLevel: 0,
  lastTranscript: "",
  voicePack: savedVoicePack,
  voiceRate: Number.isFinite(savedVoiceRate) ? savedVoiceRate : 1.0,
  setState: (state) => set({ state }),
  setWakeWordEnabled: (wakeWordEnabled) => set({ wakeWordEnabled }),
  setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setLastTranscript: (lastTranscript) => set({ lastTranscript }),
  setVoicePack: (voicePack) => {
    if (typeof window !== "undefined") localStorage.setItem("edith_voice_pack", voicePack);
    set({ voicePack });
  },
  setVoiceRate: (voiceRate) => {
    if (typeof window !== "undefined") localStorage.setItem("edith_voice_rate", String(voiceRate));
    set({ voiceRate });
  },
}));

