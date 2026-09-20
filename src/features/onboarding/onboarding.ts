export const TUTORIAL_ENABLED_KEY =
  "fyflate.onboarding.tutorialEnabled.v1";

export const ONBOARDING_COMPLETED_KEY =
  "fyflate.onboarding.completed.v1";

export const LAST_SEEN_VERSION_KEY =
  "fyflate.onboarding.lastSeenVersion.v1";

export type TutorialId =
  | "basic"
  | "accounts"
  | "user-tools"
  | "inbox"
  | "appearance"
  | "obs";

export type TutorialView =
  | "main"
  | "inbox"
  | "settings-accounts"
  | "settings-highlights"
  | "settings-appearance"
  | "settings-obs";

export type TutorialStep = {
  id: string;
  targetId: string;
  view: TutorialView;
  titleNo: string;
  titleEn: string;
  bodyNo: string;
  bodyEn: string;
};

export type TutorialDefinition = {
  id: TutorialId;
  titleNo: string;
  titleEn: string;
  descriptionNo: string;
  descriptionEn: string;
  steps: TutorialStep[];
};

const BASIC_STEPS: TutorialStep[] = [
  {
    id: "channels",
    targetId: "channel-list",
    view: "main",
    titleNo: "Kanaler",
    titleEn: "Channels",
    bodyNo: "Her ligger kanalene dine. Du kan dra dem for å endre rekkefølge, eller dra én over en annen for å samle chatter.",
    bodyEn: "Your channels live here. Drag to reorder them, or drop one onto another to combine chats.",
  },
  {
    id: "add-channel",
    targetId: "add-channel",
    view: "main",
    titleNo: "Legg til kanal",
    titleEn: "Add a channel",
    bodyNo: "Trykk pluss for å legge til en Twitch-, Kick- eller YouTube-kanal.",
    bodyEn: "Select the plus button to add a Twitch, Kick, or YouTube channel.",
  },
  {
    id: "chat",
    targetId: "chat",
    view: "main",
    titleNo: "Samlet chat",
    titleEn: "Combined chat",
    bodyNo: "Alle meldingene i den valgte kanalfanen vises her, med plattformikon, badges og emoter.",
    bodyEn: "Messages for the selected channel tab appear here with platform icons, badges, and emotes.",
  },
  {
    id: "user-profile",
    targetId: "chat",
    view: "main",
    titleNo: "Brukerprofil",
    titleEn: "User profile",
    bodyNo: "Trykk på et navn i chatten for profil, lokale kallenavn, notater, ignorering og modereringsverktøy.",
    bodyEn: "Select a name in chat for the profile, local nicknames, notes, ignores, and moderation tools.",
  },
  {
    id: "reply",
    targetId: "chat-input",
    view: "main",
    titleNo: "Svar og send",
    titleEn: "Reply and send",
    bodyNo: "Hold pekeren over en Twitch-melding for å svare. I samlede faner kan /t, /k eller /y velge plattform.",
    bodyEn: "Hover over a Twitch message to reply. In combined tabs, /t, /k, or /y selects the platform.",
  },
  {
    id: "emotes",
    targetId: "chat-input",
    view: "main",
    titleNo: "Emoter",
    titleEn: "Emotes",
    bodyNo: "Skriv et emote-navn eller bruk smileknappen. Forslaget sendes først når du velger det.",
    bodyEn: "Type an emote name or use the smile button. A suggestion is only sent after you choose it.",
  },
  {
    id: "inbox",
    targetId: "inbox-button",
    view: "main",
    titleNo: "Smart innboks",
    titleEn: "Smart inbox",
    bodyNo: "Her samles omtaler, svar, private Twitch-meldinger og viktige hendelser fra alle plattformer.",
    bodyEn: "Mentions, replies, Twitch private messages, and important events from every platform are collected here.",
  },
  {
    id: "settings",
    targetId: "settings-button",
    view: "main",
    titleNo: "Innstillinger",
    titleEn: "Settings",
    bodyNo: "Her finner du kontoer, utseende, chatvalg, markeringer og alle hjelpefunksjonene.",
    bodyEn: "Find accounts, appearance, chat options, highlights, and all help features here.",
  },
  {
    id: "highlights",
    targetId: "settings-highlights",
    view: "settings-highlights",
    titleNo: "Markeringer",
    titleEn: "Highlights",
    bodyNo: "Gi viktige personer egen farge, lyd og en valgfri, rolig puls så meldingene blir lettere å oppdage.",
    bodyEn: "Give important people a color, sound, and optional subtle pulse so their messages are easier to notice.",
  },
];

export const TUTORIALS: Record<TutorialId, TutorialDefinition> = {
  basic: {
    id: "basic",
    titleNo: "Grunnrunde i FyFlade",
    titleEn: "FyFlade basic tour",
    descriptionNo: "Kanaler, chat, profiler, emoter, innboks og innstillinger.",
    descriptionEn: "Channels, chat, profiles, emotes, inbox, and settings.",
    steps: BASIC_STEPS,
  },
  accounts: {
    id: "accounts",
    titleNo: "Kontoer og plattformer",
    titleEn: "Accounts and platforms",
    descriptionNo: "Hvor du kobler til og kontrollerer Twitch, Kick og YouTube.",
    descriptionEn: "Where to connect and check Twitch, Kick, and YouTube.",
    steps: [
      {
        id: "accounts-overview",
        targetId: "settings-accounts",
        view: "settings-accounts",
        titleNo: "Kontoene dine",
        titleEn: "Your accounts",
        bodyNo: "Her ser du om hver plattform er tilkoblet. Du kan logge inn igjen uten å fjerne kanalene dine.",
        bodyEn: "See whether each platform is connected here. You can sign in again without removing your channels.",
      },
    ],
  },
  "user-tools": {
    id: "user-tools",
    titleNo: "Brukerverktøy",
    titleEn: "User tools",
    descriptionNo: "Profiler, kallenavn, svar, ignorering og markeringer.",
    descriptionEn: "Profiles, nicknames, replies, ignores, and highlights.",
    steps: [
      {
        id: "open-profile",
        targetId: "chat",
        view: "main",
        titleNo: "Trykk på et navn",
        titleEn: "Select a name",
        bodyNo: "Et klikk på et navn åpner personens profil og handlingene som passer plattformen.",
        bodyEn: "Selecting a name opens that person's profile and the actions supported by the platform.",
      },
      {
        id: "highlight-tools",
        targetId: "settings-highlights",
        view: "settings-highlights",
        titleNo: "Personlige markeringer",
        titleEn: "Personal highlights",
        bodyNo: "Markerte personer kan få egen farge, lyd og visuell puls. Alt lagres bare på denne PC-en.",
        bodyEn: "Highlighted people can have their own color, sound, and visual pulse. Everything is stored only on this PC.",
      },
    ],
  },
  inbox: {
    id: "inbox",
    titleNo: "Smart innboks",
    titleEn: "Smart inbox",
    descriptionNo: "Omtaler, svar, private meldinger og viktige hendelser.",
    descriptionEn: "Mentions, replies, private messages, and important events.",
    steps: [
      {
        id: "inbox-button",
        targetId: "inbox-button",
        view: "main",
        titleNo: "Åpne innboksen",
        titleEn: "Open the inbox",
        bodyNo: "@-knappen åpner innboksen uten å ta en fast plass blant kanalene.",
        bodyEn: "The @ button opens the inbox without taking a permanent place among your channels.",
      },
      {
        id: "inbox-content",
        targetId: "inbox-view",
        view: "inbox",
        titleNo: "Alt viktig på ett sted",
        titleEn: "Everything important in one place",
        bodyNo: "Trykk på en lagret hendelse for å gå til kanalen eller åpne avsenderens profil.",
        bodyEn: "Select a saved event to go to its channel or open the sender's profile.",
      },
    ],
  },
  appearance: {
    id: "appearance",
    titleNo: "Utseende",
    titleEn: "Appearance",
    descriptionNo: "Tema, farger, logo og bakgrunnsbilde.",
    descriptionEn: "Theme, colors, logo, and background image.",
    steps: [
      {
        id: "appearance-settings",
        targetId: "settings-appearance",
        view: "settings-appearance",
        titleNo: "Gjør FyFlade personlig",
        titleEn: "Make FyFlade yours",
        bodyNo: "Velg én farge for hele appen eller egne farger per del, og legg til logo eller bakgrunnsbilde.",
        bodyEn: "Choose one color for the whole app or separate colors per area, and add a logo or background image.",
      },
    ],
  },
  obs: {
    id: "obs",
    titleNo: "OBS-overlay",
    titleEn: "OBS overlay",
    descriptionNo: "Gjennomsiktig chat, plattformvalg, fading og testmelding.",
    descriptionEn: "Transparent chat, platform filters, fading, and a test message.",
    steps: [
      {
        id: "obs-overlay-settings",
        targetId: "settings-obs",
        view: "settings-obs",
        titleNo: "Chat på stream",
        titleEn: "Chat on stream",
        bodyNo: "Slå på overlayen, velg kanal og utseende, kopier adressen til en OBS Browser Source og prøv testmeldingen.",
        bodyEn: "Enable the overlay, choose its channel and appearance, copy the address to an OBS Browser Source, and try the test message.",
      },
    ],
  },
};

export function readTutorialEnabled() {
  try {
    const value = localStorage.getItem(TUTORIAL_ENABLED_KEY);
    return value === null ? true : value === "true";
  } catch {
    return true;
  }
}

export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
}

export function readLastSeenVersion() {
  try {
    return localStorage.getItem(LAST_SEEN_VERSION_KEY) || "";
  } catch {
    return "";
  }
}

export function markOnboardingComplete(version: string) {
  localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}

export function markVersionSeen(version: string) {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}
