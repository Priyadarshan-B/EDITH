/**
 * High-Fidelity TTS for EDITH.
 * Primary: ResponsiveVoice.js (Indian/UK female, natural, fast)
 * Fallback: Browser SpeechSynthesis (Heera/Zira female voice)
 */

declare const responsiveVoice: {
  speak: (text: string, voice: string, params?: object) => void;
  cancel: () => void;
  isPlaying: () => boolean;
  voiceSupport: () => boolean;
  OnVoiceReady?: () => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export const cleanTextForSpeech = (raw: string): string => {
  return raw
    .replace(/\[(?:Gemini|Ollama|Streaming|Error|Groq|OpenRouter)[^\]]*\]/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/[#*`_~]/g, "")
    .replace(/\{[\s\S]*?\}/g, "")
    .replace(/[⚡⚠️🔒•]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

// ─── Native SpeechSynthesis fallback ─────────────────────────────────────────

let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

const getNativeFemaleVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedVoices.length === 0) cachedVoices = window.speechSynthesis.getVoices();

  const MALE_NAMES = ["david", "george", "mark", "ravi", "james", "richard", "daniel"];
  const FEMALE_PRIORITY = ["heera", "neerja", "zira", "samantha", "hazel", "jenny", "aria", "sonia", "emma", "susan"];

  // Try named female voices first
  for (const name of FEMALE_PRIORITY) {
    const v = cachedVoices.find(v => v.name.toLowerCase().includes(name));
    if (v) return v;
  }

  // Try any non-male English voice
  const nonMale = cachedVoices.find(v =>
    v.lang.startsWith("en") &&
    !MALE_NAMES.some(m => v.name.toLowerCase().includes(m))
  );
  return nonMale || cachedVoices[0] || null;
};

// ─── Main speak function ──────────────────────────────────────────────────────

export const speakText = (text: string, onEnd?: () => void): void => {
  if (typeof window === "undefined") return;

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;

  // Try ResponsiveVoice first (best quality)
  if (typeof responsiveVoice !== "undefined" && responsiveVoice.voiceSupport()) {
    try {
      responsiveVoice.cancel();
      responsiveVoice.speak(cleaned, "UK English Female", {
        pitch: 1,
        rate: 1.1,
        volume: 1,
        onend: onEnd,
        onerror: () => {
          // Fallback to native on RV error
          nativeFallbackSpeak(cleaned, onEnd);
        },
      });
      return;
    } catch {
      // fall through to native
    }
  }

  nativeFallbackSpeak(cleaned, onEnd);
};

const nativeFallbackSpeak = (cleaned: string, onEnd?: () => void): void => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.rate = 1.1;
  utter.pitch = 1.1;

  const trySpeak = () => {
    const voice = getNativeFemaleVoice();
    if (voice) utter.voice = voice;
    if (onEnd) {
      utter.onend = onEnd;
      utter.onerror = () => onEnd();
    }
    window.speechSynthesis.speak(utter);
  };

  if (cachedVoices.length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", trySpeak, { once: true });
    setTimeout(trySpeak, 200);
  } else {
    trySpeak();
  }
};

export const stopSpeech = (): void => {
  if (typeof responsiveVoice !== "undefined") {
    try { responsiveVoice.cancel(); } catch { /* ignore */ }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

export const getBestHumanFemaleVoice = (): SpeechSynthesisVoice | null => {
  return getNativeFemaleVoice();
};
