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

  // Select optimal natural female voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (v) =>
      v.name.toLowerCase().includes("zira") ||
      v.name.toLowerCase().includes("female") ||
      v.name.toLowerCase().includes("samantha") ||
      v.name.toLowerCase().includes("aria") ||
      v.name.toLowerCase().includes("jenny") ||
      v.name.toLowerCase().includes("catherine") ||
      v.name.toLowerCase().includes("susan") ||
      v.name.toLowerCase().includes("hazel") ||
      v.name.toLowerCase().includes("google us english") ||
      v.name.toLowerCase().includes("natural") ||
      (v.lang === "en-US" && !v.name.toLowerCase().includes("david") && !v.name.toLowerCase().includes("george"))
  ) || voices.find((v) => v.lang.startsWith("en"));

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

