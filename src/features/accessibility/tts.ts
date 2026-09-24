export type TtsMessageMode = "highlights" | "mentions" | "all";
export type TtsLanguage = "auto" | "no-NO" | "en-US" | "es-ES" | "de-DE" | "fr-FR";
export type TtsPlatform = "twitch" | "kick" | "youtube";

export type TtsSettings = {
  enabled: boolean;
  mode: TtsMessageMode;
  hoverEnabled: boolean;
  hoverDelayMs: number;
  includeUsername: boolean;
  includeMessage: boolean;
  provider: "system";
  voiceUri: string;
  voiceByLanguage: Record<string, string>;
  language: TtsLanguage;
  rate: number;
  pitch: number;
  volume: number;
  platforms: Record<TtsPlatform, boolean>;
  ignoreBots: boolean;
  ignoreCommands: boolean;
  maxQueue: number;
  skipOlderThanMs: number;
};

export type TtsQueueOptions = {
  priority?: number;
  languageHint?: Exclude<TtsLanguage, "auto">;
  createdAt?: number;
};

type QueueItem = {
  id: number;
  settings: TtsSettings;
  text: string;
  priority: number;
  language: Exclude<TtsLanguage, "auto">;
  createdAt: number;
};

export const TTS_SETTINGS_KEY = "fyflade.accessibility.tts.v1";

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  enabled: false,
  mode: "highlights",
  hoverEnabled: false,
  hoverDelayMs: 700,
  includeUsername: true,
  includeMessage: true,
  provider: "system",
  voiceUri: "",
  voiceByLanguage: {},
  language: "auto",
  rate: 1,
  pitch: 1,
  volume: 0.8,
  platforms: { twitch: true, kick: true, youtube: true },
  ignoreBots: true,
  ignoreCommands: true,
  maxQueue: 8,
  skipOlderThanMs: 30_000,
};

const SUPPORTED_LANGUAGES: TtsLanguage[] = ["auto", "no-NO", "en-US", "es-ES", "de-DE", "fr-FR"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeTtsSettings(value: Partial<TtsSettings> | null | undefined): TtsSettings {
  const platforms = value?.platforms || DEFAULT_TTS_SETTINGS.platforms;
  return {
    enabled: value?.enabled === true,
    mode: value?.mode === "mentions" || value?.mode === "all" ? value.mode : "highlights",
    hoverEnabled: value?.hoverEnabled === true,
    hoverDelayMs: typeof value?.hoverDelayMs === "number"
      ? clamp(Math.round(value.hoverDelayMs), 250, 3000)
      : DEFAULT_TTS_SETTINGS.hoverDelayMs,
    includeUsername: value?.includeUsername !== false,
    includeMessage: value?.includeMessage !== false,
    provider: "system",
    voiceUri: typeof value?.voiceUri === "string" ? value.voiceUri : "",
    voiceByLanguage: value?.voiceByLanguage && typeof value.voiceByLanguage === "object"
      ? Object.fromEntries(Object.entries(value.voiceByLanguage).filter((entry) => typeof entry[1] === "string"))
      : {},
    language: SUPPORTED_LANGUAGES.includes(value?.language as TtsLanguage)
      ? value!.language as TtsLanguage
      : "auto",
    rate: typeof value?.rate === "number" ? clamp(value.rate, 0.6, 1.8) : 1,
    pitch: typeof value?.pitch === "number" ? clamp(value.pitch, 0.5, 2) : 1,
    volume: typeof value?.volume === "number" ? clamp(value.volume, 0, 1) : 0.8,
    platforms: {
      twitch: platforms.twitch !== false,
      kick: platforms.kick !== false,
      youtube: platforms.youtube !== false,
    },
    ignoreBots: value?.ignoreBots !== false,
    ignoreCommands: value?.ignoreCommands !== false,
    maxQueue: typeof value?.maxQueue === "number" ? clamp(Math.round(value.maxQueue), 1, 20) : 8,
    skipOlderThanMs: typeof value?.skipOlderThanMs === "number"
      ? clamp(Math.round(value.skipOlderThanMs), 5_000, 120_000)
      : 30_000,
  };
}

export function readTtsSettings(): TtsSettings {
  try {
    const raw = localStorage.getItem(TTS_SETTINGS_KEY);
    return normalizeTtsSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_TTS_SETTINGS };
  }
}

export function writeTtsSettings(settings: TtsSettings) {
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(normalizeTtsSettings(settings)));
}

const WORD_HINTS: Array<[Exclude<TtsLanguage, "auto">, RegExp]> = [
  ["no-NO", /[æøå]|\b(ikke|jeg|deg|det|som|og|eller|takk|hei|hva|kan|skal)\b/i],
  ["es-ES", /[¿¡ñ]|\b(hola|gracias|por|para|que|como|una|con|está)\b/i],
  ["de-DE", /[äöüß]|\b(hallo|danke|und|nicht|ist|wie|eine|mit)\b/i],
  ["fr-FR", /[àâçéèêëîïôûùüÿœ]|\b(bonjour|merci|avec|pour|une|est|pas)\b/i],
];

export function detectTtsLanguage(text: string): Exclude<TtsLanguage, "auto"> {
  return WORD_HINTS.find(([, pattern]) => pattern.test(text))?.[0] || "en-US";
}

let nextQueueId = 1;
let speaking = false;
let queue: QueueItem[] = [];

function chooseVoice(item: QueueItem) {
  const voices = window.speechSynthesis.getVoices();
  const preferredUri = item.settings.voiceByLanguage[item.language] || item.settings.voiceUri;
  const preferred = voices.find((voice) => voice.voiceURI === preferredUri);
  if (preferred) return preferred;
  const base = item.language.split("-")[0].toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === item.language.toLowerCase())
    || voices.find((voice) => voice.lang.toLowerCase().startsWith(`${base}-`));
}

function playNext() {
  if (speaking || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  const now = Date.now();
  let item = queue.shift();
  while (item && now - item.createdAt > item.settings.skipOlderThanMs) item = queue.shift();
  if (!item) return;

  speaking = true;
  const utterance = new SpeechSynthesisUtterance(item.text);
  utterance.rate = item.settings.rate;
  utterance.pitch = item.settings.pitch;
  utterance.volume = item.settings.volume;
  utterance.lang = item.language;
  const voice = chooseVoice(item);
  if (voice) utterance.voice = voice;
  const finish = () => {
    speaking = false;
    window.setTimeout(playNext, 0);
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
}

export function stopTts() {
  queue = [];
  speaking = false;
  window.speechSynthesis?.cancel();
}

export function ttsQueueSize() {
  return queue.length + (speaking ? 1 : 0);
}

export function enqueueTts(settingsValue: TtsSettings, text: string, options: TtsQueueOptions = {}) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  const settings = normalizeTtsSettings(settingsValue);
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!clean) return false;
  const language = options.languageHint || (settings.language === "auto" ? detectTtsLanguage(clean) : settings.language);
  const item: QueueItem = {
    id: nextQueueId++, settings, text: clean, priority: options.priority || 0,
    language, createdAt: options.createdAt || Date.now(),
  };
  queue.push(item);
  queue.sort((a, b) => b.priority - a.priority || a.id - b.id);
  while (queue.length > settings.maxQueue) {
    const lowestPriority = Math.min(...queue.map((queued) => queued.priority));
    const removableItems = queue.map((queued, index) => ({ queued, index }))
      .filter(({ queued }) => queued.priority === lowestPriority);
    const removable = removableItems.length
      ? removableItems[removableItems.length - 1].index
      : queue.length - 1;
    queue.splice(removable, 1);
  }
  playNext();
  return true;
}

export function speakTts(settings: TtsSettings, text: string) {
  return enqueueTts(settings, text, { priority: 10 });
}
