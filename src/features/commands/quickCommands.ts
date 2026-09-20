import { normalizeSearch } from "../search/globalSearch";
import type { SettingsSectionId } from "../settings/settingsSearch";
import { readUnknownJsonSetting, writeSetting } from "../../lib/localSettings";

export type CommandGroup = "navigation" | "settings" | "streaming" | "help" | "channels";
export type CommandAction =
  | { kind: "edit-layout" | "reset-layout" }
  | { kind: "profile"; profileId: string }
  | { kind: "settings"; section: SettingsSectionId; focus?: string }
  | { kind: "channel"; channelId: string }
  | { kind: "search" | "inbox" | "tutorial" | "diagnostics" | "system-check" };
export type QuickCommand = { id: string; group: CommandGroup; titleNo: string; titleEn: string; aliases: string; action: CommandAction; descriptionNo?: string; descriptionEn?: string };
export const COMMAND_GROUPS: CommandGroup[] = ["navigation", "settings", "streaming", "help", "channels"];
export const RECENT_COMMANDS_KEY = "fyflate.quickCommands.recent.v1";
const settings = (id: string, titleNo: string, titleEn: string, section: SettingsSectionId, aliases: string, group: CommandGroup = "settings", focus?: string): QuickCommand => ({ id, titleNo, titleEn, group, aliases, action: { kind: "settings", section, focus } });
export const QUICK_COMMANDS: QuickCommand[] = [
  { id: "edit-layout", titleNo: "Rediger gjeldende layout", titleEn: "Edit current layout", group: "settings", aliases: "layout edit rediger oppsett dock split panel", action: { kind: "edit-layout" } },
  { id: "reset-layout", titleNo: "Tilbakestill profillayout…", titleEn: "Reset profile layout…", group: "settings", aliases: "layout reset tilbakestill oppsett", action: { kind: "reset-layout" } },
  settings("profiles", "Åpne profiler", "Open Profiles", "profiles", "profiles presets profiler oppsett"),
  settings("settings", "Åpne innstillinger", "Open Settings", "general", "settings innstillinger general generelt", "navigation"),
  { id: "search", titleNo: "Åpne globalt søk", titleEn: "Open Global Search", group: "navigation", aliases: "search søk finn find ctrl shift f", action: { kind: "search" } },
  { id: "inbox", titleNo: "Åpne innboks", titleEn: "Open Inbox", group: "navigation", aliases: "inbox innboks mentions omtaler replies svar", action: { kind: "inbox" } },
  settings("help", "Åpne hjelp og gjennomgang", "Open Help / Tutorial", "help", "help hjelp tutorial guide gjennomgang", "navigation"),
  settings("accounts", "Åpne kontoer", "Open Accounts", "accounts", "accounts kontoer login innlogging"),
  settings("appearance", "Åpne utseende", "Open Appearance", "appearance", "appearance utseende theme tema farge color"),
  settings("chat", "Åpne chatinnstillinger", "Open Chat settings", "chat", "chat settings chatinnstillinger"),
  settings("ignores", "Åpne ignorerte", "Open Ignores", "ignores", "ignore ignores ignorerte ignorering"),
  settings("quota", "Åpne kvote og bruk", "Open Quota & Usage", "usage", "quota kvote usage bruk youtube yt"),
  settings("accessibility", "Åpne tilgjengelighet", "Open Accessibility", "general", "accessibility tilgjengelighet contrast kontrast motion bevegelse", "settings", "accessibility"),
  { ...settings("privacy", "Åpne data og personvern", "Open Data & Privacy", "privacy", "data privacy personvern history historikk lagring storage retention", "settings"), descriptionNo: "Viser lokale data og valg for sletting.", descriptionEn: "Shows local data and deletion controls." },
  ...(["twitch", "kick", "youtube"] as const).map(platform => settings(`account-${platform}`, `Åpne ${platform === "youtube" ? "YouTube" : platform === "twitch" ? "Twitch" : "Kick"}-konto`, `Open ${platform === "youtube" ? "YouTube" : platform === "twitch" ? "Twitch" : "Kick"} account`, "accounts", `${platform} ${platform === "youtube" ? "yt" : ""} account konto login`, "settings", `account-${platform}`)),
  settings("obs", "Åpne OBS / stream", "Open OBS / Stream", "obs", "obs stream streaming overlay dock", "streaming"),
  settings("highlights", "Åpne markeringer", "Open Highlights", "highlights", "highlight highlights high markering markeringer lyd sound puls pulse", "streaming"),
  { id: "tutorial", titleNo: "Start FyFlade-gjennomgangen", titleEn: "Start FyFlade Tutorial", group: "help", aliases: "start tutorial guide gjennomgang grunnrunde tour", action: { kind: "tutorial" } },
  { id: "diagnostics", titleNo: "Åpne diagnostikk", titleEn: "Open Diagnostics", group: "help", aliases: "diagnostics diagnostikk diagnose feilsøking", action: { kind: "diagnostics" } },
  { id: "system-check", titleNo: "Kjør systemkontroll", titleEn: "Run System Check", group: "help", aliases: "run system check kjør systemkontroll kontroll test", action: { kind: "system-check" } },
];

export function buildQuickCommands(channels: { broadcasterId: string; displayName: string; login: string; platform?: string }[]): QuickCommand[] {
  return [...QUICK_COMMANDS, ...channels.map(channel => ({ id: `channel:${channel.broadcasterId}`, group: "channels" as const, titleNo: `Åpne ${channel.displayName}`, titleEn: `Open ${channel.displayName}`, aliases: `${channel.displayName} ${channel.login} ${channel.platform || "twitch"}`, action: { kind: "channel" as const, channelId: channel.broadcasterId } }))];
}
export function filterQuickCommands(commands: QuickCommand[], query: string): QuickCommand[] {
  const needle = normalizeSearch(query), terms = needle.split(/\s+/).filter(Boolean);
  return commands.filter(command => terms.every(term => normalizeSearch(`${command.titleNo} ${command.titleEn} ${command.aliases}`).includes(term))).sort((a, b) => {
    const score = (command: QuickCommand) => !needle ? 0 : normalizeSearch(command.aliases).split(/\s+/).includes(needle) ? 2 : normalizeSearch(`${command.titleNo} ${command.titleEn}`).includes(needle) ? 1 : 0;
    return score(b) - score(a);
  });
}
export function readRecentCommands(): string[] {
  const value = readUnknownJsonSetting(RECENT_COMMANDS_KEY);
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length < 256))].slice(0, 5) : [];
}
export function rememberCommand(ids: string[], id: string): string[] {
  const next = [id, ...ids.filter(item => item !== id)].slice(0, 5);
  writeSetting(RECENT_COMMANDS_KEY, next);
  return next;
}
export function isQuickCommandShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.repeat || !event.ctrlKey || event.shiftKey || event.altKey || event.metaKey || event.key.toLowerCase() !== "k") return false;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [contenteditable="true"]'))) return false;
  return true;
}
