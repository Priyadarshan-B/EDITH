import { create } from "zustand";
import { VoiceState } from "../types";

interface VoiceStoreState {
  state: VoiceState;
  wakeWordEnabled: boolean;
  audioLevel: number;
  lastTranscript: string;
  setState: (state: VoiceState) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setAudioLevel: (level: number) => void;
  setLastTranscript: (text: string) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  state: "idle",
  wakeWordEnabled: true,
  audioLevel: 0,
  lastTranscript: "",
  setState: (state) => set({ state }),
  setWakeWordEnabled: (wakeWordEnabled) => set({ wakeWordEnabled }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setLastTranscript: (lastTranscript) => set({ lastTranscript }),
}));

