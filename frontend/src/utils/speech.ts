/**
 * High-Fidelity TTS for EDITH.
 * Primary: Backend Edge-TTS Neural Female English Voice Packs
 * Fallback 1: ResponsiveVoice.js
 * Fallback 2: Browser SpeechSynthesis (female voice)
 */
import { useVoiceStore } from "../stores/voiceStore";
import { getApiBase } from "../api/config";

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let currentAbortController: AbortController | null = null;
let waveRafId: number | null = null;
let wavePulseTimer: any = null;
let sharedAudioCtx: AudioContext | null = null;

function stopWaveSync() {
  if (waveRafId !== null) {
    cancelAnimationFrame(waveRafId);
    waveRafId = null;
  }
  if (wavePulseTimer) {
    clearInterval(wavePulseTimer);
    wavePulseTimer = null;
  }
  const st = useVoiceStore.getState();
  st.setAudioLevel(0);
  if (st.state === "speaking") {
    st.setState("idle");
  }
}

function attachAudioWaveform(audio: HTMLAudioElement) {
  stopWaveSync();
  useVoiceStore.getState().setState("speaking");
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error("No AudioContext");
    if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    const source = sharedAudioCtx.createMediaElementSource(audio);
    const analyser = sharedAudioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(sharedAudioCtx.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!currentAudio || currentAudio !== audio || audio.paused || audio.ended) {
        return;
      }
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / Math.max(1, data.length);
      const level = Math.min(100, Math.round((avg / 140) * 100));
      useVoiceStore.getState().setAudioLevel(level);
      waveRafId = requestAnimationFrame(tick);
    };
    waveRafId = requestAnimationFrame(tick);
  } catch {
    // Fallback gentle wave if AudioContext unavailable
    wavePulseTimer = setInterval(() => {
      useVoiceStore.getState().setAudioLevel(25 + Math.round(Math.random() * 55));
    }, 90);
  }
}

declare const responsiveVoice: {
  speak: (text: string, voice: string, params?: object) => void;
  cancel: () => void;
  isPlaying: () => boolean;
  voiceSupport: () => boolean;
  OnVoiceReady?: () => void;
};

// ─── Human-like Speech Text Cleaner ─────────────────────────────────────────

export const cleanTextForSpeech = (raw: string): string => {
  if (!raw) return "";

  let text = raw;

  // 1. Strip code blocks completely
  text = text.replace(/```[\s\S]*?```/g, " ");

  // 2. Strip JSON-like blocks
  text = text.replace(/\{[\s\S]*?\}/g, " ");

  // 3. Strip URLs completely (so it never says "https colon slash slash...")
  text = text.replace(/https?:\/\/\S+/gi, " ");
  text = text.replace(/www\.\S+/gi, " ");

  // 4. Strip markdown table separator rows (e.g. |---|---| or |:---:|)
  text = text.replace(/\|[\s\-:]*\|[\s\-:|]*/g, " ");

  // 5. Convert table pipes '|' to a gentle comma so it pauses naturally instead of saying "vertical bar"
  text = text.replace(/\|/g, ", ");

  // 6. Convert markdown links [Label](url) -> keep only Label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 7. Strip bracketed status/system tags (e.g. [Verified Action], [Model: ...], [Streaming Error: ...])
  text = text.replace(/\[[^\]]*\]/g, " ");

  // 8. Strip technical parentheticals like (PID: 2420), (Exit code: 0), (Status: 200)
  text = text.replace(/\((?:pid|status|code|exit code|error|version)[^)]*\)/gi, " ");

  // 9. Strip multiple consecutive dashes/equals/underscores/tildes (so it never says "dash dash" or "hyphen hyphen")
  text = text.replace(/[-=_~]{2,}/g, " ");

  // 10. Strip bullet markers at start of lines (e.g. "- item", "* item", "+ item", "• item")
  text = text.replace(/(?:^|\n)\s*[-*+•]\s+/g, ". ");

  // 11. Strip numbered list headers (e.g. "1. ", "2) ")
  text = text.replace(/(?:^|\n)\s*\d+[\.)]\s+/g, ". ");

  // 12. Strip backticks around code
  text = text.replace(/`([^`]+)`/g, "$1");

  // 13. Strip literal slashes, backslashes, and special symbols that TTS reads out
  // (avoids saying "slash", "backslash", "splash", "plus", "asterisk", "hash", etc.)
  text = text.replace(/[\[\]{}()<>\/\\+=*^~_#@$%&]/g, " ");

  // 14. Replace isolated hyphens between words with commas
  text = text.replace(/\s+-\s+/g, ", ");
  text = text.replace(/^-+\s*/gm, "");

  // 15. Strip emojis and special Unicode icons
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}⚡⚠️🔒•]/gu, " ");

  // 16. Normalize punctuation: replace colons/semicolons with commas/periods so TTS doesn't say "colon"
  text = text.replace(/[:;]\s*/g, ", ");
  text = text.replace(/,\s*,+/g, ",");
  text = text.replace(/\.\s*\.+/g, ".");
  text = text.replace(/\s*([,?.!])\s*/g, "$1 ");

  // 17. Collapse multiple spaces
  text = text.replace(/\s+/g, " ");

  return text.trim();
};

/**
 * Distills long screen output into a natural, friendly spoken summary
 * so EDITH never reads dumps, tables, or long paragraphs verbatim.
 */
export const summarizeForSpeech = (raw: string): string => {
  const cleaned = cleanTextForSpeech(raw);
  if (!cleaned) return "";

  // Split into natural sentences
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (sentences.length <= 2 && cleaned.length <= 240) {
    return cleaned;
  }

  // Keep up to 2 concise sentences (~240 chars) for friendly spoken delivery
  let summary = "";
  for (const s of sentences) {
    if ((summary + " " + s).trim().length > 250 && summary.length > 40) {
      break;
    }
    summary = summary ? `${summary} ${s}` : s;
    if (summary.split(/(?<=[.!?])\s+/).length >= 2) break;
  }

  if (!summary) {
    summary = cleaned.slice(0, 220).trim();
  }
  if (!/[.!?]$/.test(summary)) summary += ".";
  return summary;
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

  const MALE_NAMES = ["david", "george", "mark", "ravi", "james", "richard", "daniel", "brian"];
  // Southern English Female (English GB) priority
  const GB_FEMALE_PRIORITY = ["hazel", "sonia", "libby", "maisie", "georgina", "southern", "uk", "british"];
  const GENERAL_FEMALE_PRIORITY = ["zira", "heera", "neerja", "samantha", "jenny", "aria", "emma", "susan"];

  // 1. Try British / Southern English (en-GB) female voices first
  const gbVoices = cachedVoices.filter(v => v.lang.startsWith("en-GB") || v.lang === "en_GB");
  for (const name of GB_FEMALE_PRIORITY) {
    const v = gbVoices.find(v => v.name.toLowerCase().includes(name));
    if (v) return v;
  }
  const anyGbFemale = gbVoices.find(v => !MALE_NAMES.some(m => v.name.toLowerCase().includes(m)));
  if (anyGbFemale) return anyGbFemale;

  // 2. Try any named female voices
  for (const name of [...GB_FEMALE_PRIORITY, ...GENERAL_FEMALE_PRIORITY]) {
    const v = cachedVoices.find(v => v.name.toLowerCase().includes(name));
    if (v) return v;
  }

  // 3. Try any non-male English voice
  const nonMale = cachedVoices.find(v =>
    v.lang.startsWith("en") &&
    !MALE_NAMES.some(m => v.name.toLowerCase().includes(m))
  );
  return nonMale || cachedVoices[0] || null;
};

// ─── Main speak function ──────────────────────────────────────────────────────

export const speakText = (
  text: string,
  onEnd?: () => void,
  overrideVoice?: string,
  overrideRate?: number
): void => {
  if (typeof window === "undefined") return;

  const cleaned = summarizeForSpeech(text);
  if (!cleaned) return;

  stopSpeech();

  // Pre-warm AudioContext so first 1-2 words are never clipped on audio device wake
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
      if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume().catch(() => {});
      }
    }
  } catch { /* ignore */ }

  const { voicePack, voiceRate } = useVoiceStore.getState();
  const activeVoice = overrideVoice || voicePack || "en-GB-SoniaNeural";
  const activeRate = overrideRate ?? voiceRate ?? 1.0;

  const controller = new AbortController();
  currentAbortController = controller;

  fetch(`${getApiBase()}/api/v1/voice/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: cleaned,
      voice: activeVoice,
      rate: activeRate,
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const blob = await res.blob();
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      currentAudioUrl = url;
      const audio = new Audio(url);
      currentAudio = audio;

      const cleanup = () => {
        stopWaveSync();
        if (currentAudioUrl === url) {
          URL.revokeObjectURL(url);
          currentAudioUrl = null;
        }
        if (currentAudio === audio) {
          currentAudio = null;
        }
      };

      audio.onplay = () => attachAudioWaveform(audio);
      audio.onended = () => {
        cleanup();
        onEnd?.();
      };
      audio.onerror = () => {
        cleanup();
        legacyFallbackSpeak(cleaned, onEnd);
      };

      // Tiny warmup delay prevents cutting off the first word on Bluetooth/Windows audio endpoints
      await new Promise((r) => setTimeout(r, 120));
      if (controller.signal.aborted) {
        cleanup();
        return;
      }
      await audio.play();
    })
    .catch((err) => {
      if (err?.name === "AbortError") return;
      legacyFallbackSpeak(cleaned, onEnd);
    });
};

const legacyFallbackSpeak = (cleaned: string, onEnd?: () => void): void => {
  if (typeof responsiveVoice !== "undefined" && responsiveVoice.voiceSupport()) {
    try {
      responsiveVoice.cancel();
      responsiveVoice.speak(cleaned, "UK English Female", {
        pitch: 1.0,
        rate: 0.9,
        volume: 1.0,
        onend: onEnd,
        onerror: () => {
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
  // Requested speed 0.5
  utter.rate = 0.5;
  utter.pitch = 1.0;

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
  stopWaveSync();
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch { /* ignore */ }
    currentAudio = null;
  }
  if (currentAudioUrl) {
    try { URL.revokeObjectURL(currentAudioUrl); } catch { /* ignore */ }
    currentAudioUrl = null;
  }
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
