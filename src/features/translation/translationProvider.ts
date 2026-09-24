export type TranslationLanguage = "no" | "en" | "es" | "de" | "fr";
export type TranslationTarget = "app" | TranslationLanguage;

export type TranslationSettings = {
  showTranslateAction: boolean;
  targetLanguage: TranslationTarget;
  platforms: { twitch: boolean; kick: boolean; youtube: boolean };
};

export const TRANSLATION_SETTINGS_KEY = "fyflade.translation.settings.v1";
export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  showTranslateAction: true,
  targetLanguage: "app",
  platforms: { twitch: true, kick: true, youtube: true },
};

export type TranslationRequest = {
  text: string;
  targetLanguage: TranslationLanguage;
};

export type ExternalTranslationProvider = {
  id: "google-web";
  privacyLabel: string;
  buildUrl(request: TranslationRequest): string;
};

export const EXTERNAL_TRANSLATION_CONSENT_KEY =
  "fyflate.translation.externalConsent.v1";

export const googleWebTranslationProvider: ExternalTranslationProvider = {
  id: "google-web",
  privacyLabel: "Google Translate",
  buildUrl: ({ text, targetLanguage }) =>
    `https://translate.google.com/?sl=auto&tl=${targetLanguage}&text=${encodeURIComponent(text.slice(0, 1500))}&op=translate`,
};

// No provider runs automatically. A future live provider must implement an
// explicit privacy/cost contract and a bounded cache before it can be enabled.
export function hasExternalTranslationConsent() {
  return localStorage.getItem(EXTERNAL_TRANSLATION_CONSENT_KEY) === "true";
}

export function rememberExternalTranslationConsent() {
  localStorage.setItem(EXTERNAL_TRANSLATION_CONSENT_KEY, "true");
}

export function readTranslationSettings(): TranslationSettings {
  try {
    const value = JSON.parse(localStorage.getItem(TRANSLATION_SETTINGS_KEY) || "null") as Partial<TranslationSettings> | null;
    const targets: TranslationTarget[] = ["app", "no", "en", "es", "de", "fr"];
    return {
      showTranslateAction: value?.showTranslateAction !== false,
      targetLanguage: targets.includes(value?.targetLanguage as TranslationTarget) ? value!.targetLanguage as TranslationTarget : "app",
      platforms: {
        twitch: value?.platforms?.twitch !== false,
        kick: value?.platforms?.kick !== false,
        youtube: value?.platforms?.youtube !== false,
      },
    };
  } catch {
    return { ...DEFAULT_TRANSLATION_SETTINGS, platforms: { ...DEFAULT_TRANSLATION_SETTINGS.platforms } };
  }
}

export function writeTranslationSettings(settings: TranslationSettings) {
  localStorage.setItem(TRANSLATION_SETTINGS_KEY, JSON.stringify(settings));
}
