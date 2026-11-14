/**
 * High-Fidelity Browser Speech Synthesis for EDITH.
 * Provides instant offline voice playback for assistant responses.
 */

export const cleanTextForSpeech = (raw: string): string => {
  return raw
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

export const speakText = (text: string, onEnd?: () => void): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  // Cancel any active audio
  window.speechSynthesis.cancel();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  // Select optimal natural voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (v) =>
      v.name.includes("Natural") ||
      v.name.includes("David") ||
      v.name.includes("George") ||
      v.name.includes("Zira") ||
      v.name.includes("Google US") ||
      v.lang === "en-US" ||
      v.lang.startsWith("en")
  );

  if (preferredVoice) {
    utterance.voice = preferredVoice;
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
