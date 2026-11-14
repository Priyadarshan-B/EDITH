/**
 * High-Fidelity Browser Speech Synthesis for EDITH.
 * Provides instant offline voice playback for assistant responses.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

const loadVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (cachedVoices.length > 0) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
};

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export const cleanTextForSpeech = (raw: string): string => {
  return raw
    // Remove error brackets or markdown headers
    .replace(/\[(?:Gemini|Ollama|Streaming|Error)[^\]]*\]/gi, "")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code
    .replace(/`[^`]+`/g, "")
    // Remove markdown headers, bullets, bold/italic symbols
    .replace(/[#*`_~]/g, "")
    // Remove JSON-like structures
    .replace(/\{[\s\S]*?\}/g, "")
    // Remove emojis or special action glyphs
    .replace(/[⚡⚠️🔒•]/g, "")
    // Collapse multiple whitespace
    .replace(/\s+/g, " ")
    .trim();
};

export const getBestHumanFemaleVoice = (): SpeechSynthesisVoice | null => {
  const voices = loadVoices();
  if (!voices || voices.length === 0) return null;

  // Priority human-like natural female voices
  // 1. Natural online voices (Edge / Chrome Natural / Neural voices)
  const naturalFemale = voices.find(
    (v) =>
      (v.name.includes("Natural") || v.name.includes("Neural") || v.name.includes("Online")) &&
      (v.name.toLowerCase().includes("jenny") ||
        v.name.toLowerCase().includes("aria") ||
        v.name.toLowerCase().includes("sara") ||
        v.name.toLowerCase().includes("ava") ||
        v.name.toLowerCase().includes("emma") ||
        v.name.toLowerCase().includes("michelle") ||
        v.name.toLowerCase().includes("sonia") ||
        v.name.toLowerCase().includes("neerja"))
  );
  if (naturalFemale) return naturalFemale;

  // 2. High quality Indian English female (e.g. Microsoft Heera, Neerja)
  const indianFemale = voices.find(
    (v) =>
      v.lang.startsWith("en-IN") &&
      (v.name.toLowerCase().includes("heera") ||
        v.name.toLowerCase().includes("neerja") ||
        v.name.toLowerCase().includes("female") ||
        !v.name.toLowerCase().includes("ravi"))
  );
  if (indianFemale) return indianFemale;

  // 3. High quality US/UK female voices (Zira, Samantha, Hazel, Jenny, Google US English)
  const usUkFemale = voices.find(
    (v) =>
      (v.lang.startsWith("en-US") || v.lang.startsWith("en-GB") || v.lang.startsWith("en")) &&
      (v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("hazel") ||
        v.name.toLowerCase().includes("jenny") ||
        v.name.toLowerCase().includes("susan") ||
        v.name.toLowerCase().includes("catherine") ||
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("google us english")) &&
      !v.name.toLowerCase().includes("david") &&
      !v.name.toLowerCase().includes("george") &&
      !v.name.toLowerCase().includes("mark") &&
      !v.name.toLowerCase().includes("ravi")
  );
  if (usUkFemale) return usUkFemale;

  // 4. Any English voice that is not explicitly male
  const anyNonMale = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      !v.name.toLowerCase().includes("david") &&
      !v.name.toLowerCase().includes("george") &&
      !v.name.toLowerCase().includes("mark") &&
      !v.name.toLowerCase().includes("ravi")
  );
  return anyNonMale || voices[0] || null;
};

export const speakText = (text: string, onEnd?: () => void): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  // Cancel any active audio
  window.speechSynthesis.cancel();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;

  const utterance = new SpeechSynthesisUtterance(cleaned);
  // Human-like conversational cadence and pitch
  utterance.rate = 1.0;
  utterance.pitch = 1.05;

  const femaleVoice = getBestHumanFemaleVoice();
  if (femaleVoice) {
    utterance.voice = femaleVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = () => onEnd();
  }

  window.speechSynthesis.speak(utterance);
};

export const stopSpeech = (): void => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

