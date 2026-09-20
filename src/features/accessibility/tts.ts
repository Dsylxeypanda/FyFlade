export type TtsMessageMode = "highlights" | "mentions" | "all";

export type TtsSettings = {
  enabled: boolean;
  mode: TtsMessageMode;
  hoverEnabled: boolean;
  hoverDelayMs: number;
  includeUsername: boolean;
  voiceUri: string;
  language: "auto" | "no-NO" | "en-US";
  rate: number;
  volume: number;
};

export const TTS_SETTINGS_KEY = "fyflade.accessibility.tts.v1";

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  enabled: false,
  mode: "highlights",
  hoverEnabled: false,
  hoverDelayMs: 700,
  includeUsername: true,
  voiceUri: "",
  language: "auto",
  rate: 1,
  volume: 0.8,
};

export function normalizeTtsSettings(value: Partial<TtsSettings> | null | undefined): TtsSettings {
  return {
    enabled: value?.enabled === true,
    mode: value?.mode === "mentions" || value?.mode === "all" ? value.mode : "highlights",
    hoverEnabled: value?.hoverEnabled === true,
    hoverDelayMs: typeof value?.hoverDelayMs === "number"
      ? Math.max(250, Math.min(3000, Math.round(value.hoverDelayMs)))
      : DEFAULT_TTS_SETTINGS.hoverDelayMs,
    includeUsername: value?.includeUsername !== false,
    voiceUri: typeof value?.voiceUri === "string" ? value.voiceUri : "",
    language: value?.language === "no-NO" || value?.language === "en-US" ? value.language : "auto",
    rate: typeof value?.rate === "number" ? Math.max(0.6, Math.min(1.8, value.rate)) : 1,
    volume: typeof value?.volume === "number" ? Math.max(0, Math.min(1, value.volume)) : 0.8,
  };
}

export function readTtsSettings(): TtsSettings {
  try {
    const raw = localStorage.getItem(TTS_SETTINGS_KEY);
    return normalizeTtsSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_TTS_SETTINGS;
  }
}

export function writeTtsSettings(settings: TtsSettings) {
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(normalizeTtsSettings(settings)));
}

export function stopTts() {
  window.speechSynthesis?.cancel();
}

export function speakTts(settings: TtsSettings, text: string) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!clean) return false;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = settings.rate;
  utterance.volume = settings.volume;
  const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.voiceURI === settings.voiceUri);
  if (voice) utterance.voice = voice;
  if (settings.language !== "auto") utterance.lang = settings.language;

  // Keep the queue bounded. The latest relevant message replaces stale speech.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
