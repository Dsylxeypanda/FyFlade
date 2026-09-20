export type TranslationLanguage = "no" | "en";

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
