import { create } from "zustand";
import { VoiceState } from "../types";

interface VoiceStoreState {
  state: VoiceState;
  wakeWordEnabled: boolean;
  ttsEnabled: boolean;
  audioLevel: number;
  lastTranscript: string;
  setState: (state: VoiceState) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setAudioLevel: (level: number) => void;
  setLastTranscript: (text: string) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  state: "idle",
  wakeWordEnabled: true,
  ttsEnabled: true,
  audioLevel: 0,
  lastTranscript: "",
  setState: (state) => set({ state }),
  setWakeWordEnabled: (wakeWordEnabled) => set({ wakeWordEnabled }),
  setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setLastTranscript: (lastTranscript) => set({ lastTranscript }),
}));

