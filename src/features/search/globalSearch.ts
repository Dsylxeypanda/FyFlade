import { SETTINGS_SEARCH_ENTRIES, type SettingsSectionId } from "../settings/settingsSearch";
import { CHAT_HISTORY_MAX_AGE_MS } from "../../lib/chatHistory";
import { TUTORIALS, type TutorialId } from "../onboarding/onboarding";
import { localUserKey, type LocalNickname, type LocalUserPlatform } from "../users/localUserTools";

export type SearchPlatform = LocalUserPlatform;
export type SearchCategory = "channels" | "users" | "settings" | "messages" | "help";
export type SearchMessage = {
  id: string; kind: "chat" | "system"; timestampMs: number; time: string;
  username: string; userLogin: string; userId: string; text: string; color: string;
  platform?: SearchPlatform;
};
export type SearchChannel = {
  broadcasterId: string; login: string; displayName: string; platform?: SearchPlatform;
  kickBroadcasterUserId?: string; kickChannelSlug?: string; youtubeChannelId?: string;
  messages: SearchMessage[];
};
export type HistorySearchRow = { platform: SearchPlatform; channel: string; timestampMs: number; payloadJson: string };
export type SearchContext = { channelId: string; channelName: string; channelLogin: string; platform: SearchPlatform };
export type SearchTarget =
  | { kind: "channel"; channelId: string }
  | { kind: "user"; message: SearchMessage; context: SearchContext }
  | { kind: "message"; message: SearchMessage; context: SearchContext }
  | { kind: "settings"; section: SettingsSectionId; advanced: boolean }
  | { kind: "help"; tutorial: TutorialId };
export type SearchDocument = {
  id: string; category: SearchCategory; title: string; description: string;
  names: string[]; searchable: string; target: SearchTarget;
  platform?: SearchPlatform; platforms?: SearchPlatform[]; channelId?: string; timestampMs?: number;
};
export const SEARCH_HISTORY_AGE_MS = CHAT_HISTORY_MAX_AGE_MS;
export const SEARCH_MESSAGE_LIMIT = 5000;
const withinRetention = (timestampMs: number, now: number, maxAgeMs: number) =>
  timestampMs <= now && (maxAgeMs === 0 || timestampMs >= now - maxAgeMs);
export function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}
const platformNames = { twitch: "Twitch", kick: "Kick", youtube: "YouTube" };
const platformAliases = (platform: SearchPlatform) => platform === "youtube" ? "youtube yt" : platform;
const sanitize = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

export function historyContext(row: HistorySearchRow, channels: SearchChannel[]): SearchContext {
  const tab = channels.find((channel) => {
    if (row.platform === "kick") return sanitize(channel.kickBroadcasterUserId || ((channel.platform === "kick") ? channel.broadcasterId.replace(/^kick:/, "") : "")) === row.channel;
    if (row.platform === "youtube") return sanitize(channel.youtubeChannelId || (channel.platform === "youtube" ? channel.login : "")) === row.channel;
    return (channel.platform || "twitch") === "twitch" && sanitize(channel.login) === row.channel;
  });
  return { channelId: tab?.broadcasterId || "", channelName: tab?.displayName || row.channel, channelLogin: row.channel, platform: row.platform };
}

export function parseSearchHistory(row: HistorySearchRow, now: number, maxAgeMs = SEARCH_HISTORY_AGE_MS): SearchMessage | null {
  if (!["twitch", "kick", "youtube"].includes(row.platform) || !withinRetention(row.timestampMs, now, maxAgeMs)) return null;
  try {
    const value = JSON.parse(row.payloadJson);
    if (!value || value.kind !== "chat" || typeof value.text !== "string" || typeof value.username !== "string" || typeof value.id !== "string") return null;
    // Keep only the fields needed for local search and the existing profile entry point.
    return { id: value.id, kind: "chat", timestampMs: row.timestampMs, time: typeof value.time === "string" ? value.time : "", username: value.username, userLogin: typeof value.userLogin === "string" ? value.userLogin : "", userId: typeof value.userId === "string" ? value.userId : "", text: value.text, color: typeof value.color === "string" ? value.color : "", platform: row.platform };
  } catch { return null; }
}

export function buildGlobalSearchIndex(
  channels: SearchChannel[], history: HistorySearchRow[], nicknames: Record<string, LocalNickname>,
  language: "no" | "en", now = Date.now(), isIgnored: (message: SearchMessage) => boolean = () => false,
  maxAgeMs = SEARCH_HISTORY_AGE_MS
): SearchDocument[] {
  const docs: SearchDocument[] = [];
  const users = new Map<string, SearchDocument>();
  const messages = new Map<string, { message: SearchMessage; context: SearchContext }>();
  const addMessage = (message: SearchMessage, context: SearchContext) => {
    if (message.kind !== "chat" || !withinRetention(message.timestampMs, now, maxAgeMs) || isIgnored(message)) return;
    const key = `${context.platform}:${context.channelId || context.channelLogin}:${message.id}`;
    messages.set(key, { message, context });
  };
  for (const channel of channels) {
    const platform = channel.platform || "twitch";
    const platforms = Array.from(new Set([platform, ...(channel.kickBroadcasterUserId ? ["kick" as const] : []), ...(channel.youtubeChannelId ? ["youtube" as const] : [])]));
    const names = [channel.displayName, channel.login, channel.kickChannelSlug || "", channel.youtubeChannelId || "", channel.kickBroadcasterUserId || "", channel.broadcasterId];
    docs.push({ id: `channel:${channel.broadcasterId}`, category: "channels", title: channel.displayName, description: platforms.map(p => platformNames[p]).join(" · "), names, searchable: normalizeSearch([...names, ...platforms.map(platformAliases)].join(" ")), target: { kind: "channel", channelId: channel.broadcasterId }, channelId: channel.broadcasterId, platforms });
    for (const message of channel.messages) {
      const source = message.platform || platform;
      addMessage({ ...message, platform: source }, { channelId: channel.broadcasterId, channelName: channel.displayName, channelLogin: source === "youtube" ? channel.youtubeChannelId || channel.login : source === "kick" ? channel.kickBroadcasterUserId || channel.login : channel.login, platform: source });
    }
  }
  for (const row of history) {
    const message = parseSearchHistory(row, now, maxAgeMs);
    if (message) addMessage(message, historyContext(row, channels));
  }
  const addUser = (message: SearchMessage, context: SearchContext) => {
    const key = localUserKey(context.platform, message.userId, message.userLogin || message.username);
    if (users.has(key)) return;
    const nickname = nicknames[key]?.nickname || "";
    const names = [nickname, message.username, message.userLogin, message.userId].filter(Boolean);
    users.set(key, { id: `user:${key}`, category: "users", title: nickname || message.username, description: [nickname ? message.username : message.userLogin, platformNames[context.platform], context.channelName].filter(Boolean).join(" · "), names, searchable: normalizeSearch([...names, platformAliases(context.platform)].join(" ")), target: { kind: "user", message, context }, platform: context.platform, channelId: context.channelId });
  };
  for (const [key, { message, context }] of [...messages].sort((a, b) => b[1].message.timestampMs - a[1].message.timestampMs).slice(0, SEARCH_MESSAGE_LIMIT)) {
    addUser(message, context);
    const nickname = nicknames[localUserKey(context.platform, message.userId, message.userLogin || message.username)]?.nickname || "";
    const author = nickname ? `${nickname} (${message.username})` : message.username;
    const description = `${new Date(message.timestampMs).toLocaleString(language === "no" ? "nb-NO" : "en-GB")} · ${context.channelName} · ${platformNames[context.platform]}`;
    docs.push({ id: `message:${key}`, category: "messages", title: `${author}: ${message.text}`, description, names: [], searchable: normalizeSearch(`${author} ${message.userLogin} ${message.text} ${context.channelName} ${platformAliases(context.platform)}`), target: { kind: "message", message, context }, platform: context.platform, channelId: context.channelId, timestampMs: message.timestampMs });
  }
  // Nicknames remain searchable even if this user has no retained messages.
  for (const nickname of Object.values(nicknames)) {
    addUser({ id: `nickname:${nickname.userId || nickname.userLogin}`, kind: "chat", timestampMs: now, time: "", username: nickname.userLogin || nickname.userId, userLogin: nickname.userLogin, userId: nickname.userId, text: "", color: "", platform: nickname.platform }, { channelId: "", channelName: "", channelLogin: "", platform: nickname.platform });
  }
  docs.push(...users.values());
  for (const entry of SETTINGS_SEARCH_ENTRIES) {
    docs.push({ id: `settings:${entry.id}`, category: "settings", title: language === "no" ? entry.titleNo : entry.titleEn, description: language === "no" ? entry.descriptionNo : entry.descriptionEn, names: [entry.titleNo, entry.titleEn], searchable: normalizeSearch(`${entry.titleNo} ${entry.titleEn} ${entry.descriptionNo} ${entry.descriptionEn} ${entry.keywords} ${entry.keywords.includes("youtube") ? "yt" : ""}`), target: { kind: "settings", section: entry.section, advanced: entry.advanced } });
  }
  for (const tutorial of Object.values(TUTORIALS)) {
    docs.push({ id: `help:${tutorial.id}`, category: "help", title: language === "no" ? tutorial.titleNo : tutorial.titleEn, description: language === "no" ? tutorial.descriptionNo : tutorial.descriptionEn, names: [tutorial.titleNo, tutorial.titleEn], searchable: normalizeSearch(`${tutorial.titleNo} ${tutorial.titleEn} ${tutorial.descriptionNo} ${tutorial.descriptionEn} ${tutorial.steps.map(step => `${step.titleNo} ${step.titleEn}`).join(" ")}`), target: { kind: "help", tutorial: tutorial.id } });
  }
  return docs;
}

export const SEARCH_CATEGORIES: SearchCategory[] = ["channels", "users", "settings", "messages", "help"];
export function searchGlobalIndex(index: SearchDocument[], query: string, platform: "all" | SearchPlatform = "all", channelId = "all", limit = 8, now = Date.now(), maxAgeMs = SEARCH_HISTORY_AGE_MS) {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const terms = needle.split(/\s+/);
  const matches = index.filter(doc =>
    (doc.timestampMs === undefined || withinRetention(doc.timestampMs, now, maxAgeMs)) &&
    (platform === "all" || (!doc.platform && !doc.platforms) || doc.platform === platform || doc.platforms?.includes(platform)) &&
    (channelId === "all" || doc.category === "settings" || doc.category === "help" || doc.channelId === channelId) &&
    terms.every(term => doc.searchable.includes(term))
  ).map(doc => ({ ...doc, score: doc.names.some(name => normalizeSearch(name) === needle) ? 100 : doc.names.some(name => normalizeSearch(name).startsWith(needle)) ? 60 : 10 }));
  return SEARCH_CATEGORIES.flatMap(category => matches.filter(doc => doc.category === category).sort((a, b) => b.score - a.score || (b.timestampMs || 0) - (a.timestampMs || 0) || a.title.localeCompare(b.title)).slice(0, limit));
}
