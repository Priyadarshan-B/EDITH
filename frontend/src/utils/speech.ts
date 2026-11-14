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
      // "UK English Female" or "Indian English Female" with natural conversational pace
      responsiveVoice.speak(cleaned, "UK English Female", {
        pitch: 1.0,
        rate: 1.05,
        volume: 1.0,
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
