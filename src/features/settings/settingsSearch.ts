export type SettingsSectionId =
  | "profiles"
  | "general"
  | "accounts"
  | "usage"
  | "obs"
  | "youtube"
  | "kick"
  | "emotes"
  | "chat"
  | "tabs"
  | "highlights"
  | "ignores"
  | "privacy"
  | "appearance"
  | "help";

export type SettingsSearchEntry = {
  id: string;
  section: SettingsSectionId;
  titleNo: string;
  titleEn: string;
  descriptionNo: string;
  descriptionEn: string;
  keywords: string;
  advanced: boolean;
};

export const SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  { id: "profiles", section: "profiles", titleNo: "Profiler", titleEn: "Profiles", descriptionNo: "Bytt visning eller lag din egen profil.", descriptionEn: "Switch your view or create your own profile.", keywords: "profiles presets profiler normal streamer moderator minimal layout oppsett", advanced: false },
  {
    id: "language",
    section: "general",
    titleNo: "Språk",
    titleEn: "Language",
    descriptionNo: "Automatisk PC-språk, norsk eller engelsk.",
    descriptionEn: "Automatic PC language, Norwegian, or English.",
    keywords: "språk language norsk english pc automatic automatisk",
    advanced: false,
  },
  {
    id: "accessibility",
    section: "general",
    titleNo: "Tilgjengelighet",
    titleEn: "Accessibility",
    descriptionNo: "Kontrast, redusert bevegelse og highlight-puls.",
    descriptionEn: "Contrast, reduced motion, and highlight pulse.",
    keywords: "tilgjengelighet accessibility contrast kontrast motion bevegelse pulse puls flash",
    advanced: false,
  },
  {
    id: "obs-dock",
    section: "general",
    titleNo: "OBS-dock",
    titleEn: "OBS Dock",
    descriptionNo: "Bruk den aktive chatten som en lokal OBS-dock.",
    descriptionEn: "Use the active chat as a local OBS dock.",
    keywords: "obs dock stream streamer browser source nettleser",
    advanced: false,
  },
  {
    id: "obs-overlay",
    section: "obs",
    titleNo: "OBS-overlay",
    titleEn: "OBS overlay",
    descriptionNo: "Gjennomsiktig chatvisning med badges, emoter, fading og plattformvalg.",
    descriptionEn: "Transparent chat display with badges, emotes, fading, and platform filters.",
    keywords: "obs overlay stream transparent gjennomsiktig badge emote fade font source nettleserkilde",
    advanced: false,
  },
  {
    id: "data-privacy",
    section: "privacy",
    titleNo: "Data og personvern",
    titleEn: "Data & Privacy",
    descriptionNo: "Styr anonym brukstelling og lokale personverndata.",
    descriptionEn: "Control anonymous usage counting and local privacy data.",
    keywords: "data privacy personvern anonymous anonym statistics statistikk telemetry telemetri usage bruk chat history historikk lagring storage retention nickname kallenavn ignores ignorerte delete slett",
    advanced: false,
  },
  {
    id: "backup-update",
    section: "general",
    titleNo: "Sikkerhetskopi og oppdateringer",
    titleEn: "Backup and updates",
    descriptionNo: "Sikkerhetskopier innstillinger og se etter oppdateringer.",
    descriptionEn: "Back up settings and check for updates.",
    keywords: "backup restore sikkerhetskopi gjenoppretting update oppdatering",
    advanced: true,
  },
  {
    id: "accounts",
    section: "accounts",
    titleNo: "Kontoer",
    titleEn: "Accounts",
    descriptionNo: "Koble til Twitch, Kick og YouTube.",
    descriptionEn: "Connect Twitch, Kick, and YouTube.",
    keywords: "konto account login logg inn oauth twitch kick youtube connect koble",
    advanced: false,
  },
  {
    id: "youtube-quota",
    section: "usage",
    titleNo: "Kvote og bruk",
    titleEn: "Quota & Usage",
    descriptionNo: "Se registrert YouTube API-bruk og daglig kvoteestimat.",
    descriptionEn: "View recorded YouTube API usage and the daily quota estimate.",
    keywords: "youtube quota kvote api google cloud usage bruk",
    advanced: false,
  },
  {
    id: "kick-health",
    section: "kick",
    titleNo: "Kick-tilkobling",
    titleEn: "Kick connection",
    descriptionNo: "Kontroller og reparer Kick-chatabonnementer.",
    descriptionEn: "Check and repair Kick chat subscriptions.",
    keywords: "kick webhook relay repair reparer subscription abonnement status",
    advanced: true,
  },
  {
    id: "emotes",
    section: "emotes",
    titleNo: "Emoter",
    titleEn: "Emotes",
    descriptionNo: "7TV, BTTV og emote-innstillinger.",
    descriptionEn: "7TV, BTTV, and emote settings.",
    keywords: "emote emoter 7tv bttv autocomplete forslag",
    advanced: true,
  },
  {
    id: "chat-text",
    section: "chat",
    titleNo: "Chat og tekst",
    titleEn: "Chat and text",
    descriptionNo: "Skriftstørrelse, chatlagring og kallenavn.",
    descriptionEn: "Font size, chat history, and nicknames.",
    keywords: "chat font skrift tekst size størrelse history historikk save lagre nickname kallenavn",
    advanced: false,
  },
  {
    id: "channel-tabs",
    section: "tabs",
    titleNo: "Kanalfaner og rekkefølge",
    titleEn: "Channel tabs and order",
    descriptionNo: "Plassering, størrelse, favoritter og grupper.",
    descriptionEn: "Position, size, favorites, and groups.",
    keywords: "kanal channel tabs faner layout order rekkefølge favorites favoritter groups grupper",
    advanced: true,
  },
  {
    id: "highlights",
    section: "highlights",
    titleNo: "Markeringer, lyd og puls",
    titleEn: "Highlights, sound, and pulse",
    descriptionNo: "Velg farge, lyd og visuell effekt per person.",
    descriptionEn: "Choose color, sound, and visual effect per person.",
    keywords: "highlight markering sound lyd pulse puls glow color farge notification varsling",
    advanced: false,
  },
  {
    id: "ignores",
    section: "ignores",
    titleNo: "Ignorerte brukere",
    titleEn: "Ignored users",
    descriptionNo: "Finn eller fjern lokale ignoreringer.",
    descriptionEn: "Find or remove local ignores.",
    keywords: "ignore ignorert mute skjul user bruker permanent timeout",
    advanced: false,
  },
  {
    id: "appearance",
    section: "appearance",
    titleNo: "Utseende og tema",
    titleEn: "Appearance and theme",
    descriptionNo: "Farger, bakgrunn, logo og lyst eller mørkt tema.",
    descriptionEn: "Colors, background, logo, and light or dark theme.",
    keywords: "appearance utseende theme tema color farge background bakgrunn logo dark light mørk lys",
    advanced: false,
  },
  {
    id: "tutorial-help",
    section: "help",
    titleNo: "Hjelp og gjennomgang",
    titleEn: "Help and tutorial",
    descriptionNo: "Start grunnrunden på nytt eller velg en kort mini-guide.",
    descriptionEn: "Restart the basic tour or choose a short mini-guide.",
    keywords: "help hjelp tutorial gjennomgang guide getting started kom i gang walkthrough",
    advanced: false,
  },
  {
    id: "system-check",
    section: "help",
    titleNo: "Systemkontroll",
    titleEn: "System check",
    descriptionNo: "Kontroller Twitch, Kick, YouTube, emoter, lagring og OBS.",
    descriptionEn: "Check Twitch, Kick, YouTube, emotes, storage, and OBS.",
    keywords: "system check kontroll diagnostics diagnose connection tilkobling 7tv bttv storage lagring obs",
    advanced: false,
  },
];

export function searchSettings(
  query: string,
  language: "no" | "en"
) {
  const terms = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return SETTINGS_SEARCH_ENTRIES
    .map((entry) => {
      const title = language === "no" ? entry.titleNo : entry.titleEn;
      const description =
        language === "no" ? entry.descriptionNo : entry.descriptionEn;
      const searchable = `${title} ${description} ${entry.keywords}`.toLocaleLowerCase();
      const score = terms.reduce(
        (total, term) =>
          total +
          (title.toLocaleLowerCase().includes(term) ? 4 : 0) +
          (description.toLocaleLowerCase().includes(term) ? 2 : 0) +
          (searchable.includes(term) ? 1 : 0),
        0
      );

      return { entry, score, matches: terms.every((term) => searchable.includes(term)) };
    })
    .filter((result) => result.matches)
    .sort((left, right) => right.score - left.score)
    .map((result) => result.entry);
}
