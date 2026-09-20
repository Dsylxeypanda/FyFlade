import { readUnknownJsonSetting, writeSetting } from "../../lib/localSettings";

export type ChannelSettingsPlatform = "twitch" | "kick" | "youtube";

export type ChannelSettingsOverrides = {
  saveLiveChat?: boolean;
  notifications?: boolean;
  highlights?: boolean;
  highlightSound?: boolean;
  obsOverlay?: boolean;
  platforms?: Partial<Record<ChannelSettingsPlatform, boolean>>;
};

export type ChannelSettingsMap = Record<string, ChannelSettingsOverrides>;

export const CHANNEL_SETTINGS_KEY = "fyflate.channels.settings.v1";
export const CHANNEL_IDENTITIES_KEY = "fyflate.channels.identities.v1";
export type ChannelIdentities = Record<string, string>;
type ChannelIdentity = { broadcasterId: string; login: string; platform?: ChannelSettingsPlatform };

export function readChannelIdentities(): ChannelIdentities {
  const raw = readUnknownJsonSetting(CHANNEL_IDENTITIES_KEY);
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw).filter(([key, value]) => key.startsWith("cached:") && typeof value === "string" && /^\d+$/.test(value)))
    : {};
}

export function channelSettingsId(tab: ChannelIdentity, identities: ChannelIdentities): string {
  return identities[tab.broadcasterId] || tab.broadcasterId;
}

// Cached Twitch tabs must keep the same settings before and after authentication.
export function reconcileChannelIdentities(settings: ChannelSettingsMap, identities: ChannelIdentities, tabs: ChannelIdentity[]) {
  const nextSettings = { ...settings };
  const nextIdentities = { ...identities };
  for (const tab of tabs) {
    if ((tab.platform || "twitch") !== "twitch" || !/^\d+$/.test(tab.broadcasterId)) continue;
    const cachedId = `cached:${tab.login.toLowerCase()}`;
    nextIdentities[cachedId] = tab.broadcasterId;
    if (Object.prototype.hasOwnProperty.call(nextSettings, cachedId)) {
      nextSettings[tab.broadcasterId] = nextSettings[cachedId];
      delete nextSettings[cachedId];
    }
  }
  return { settings: nextSettings, identities: nextIdentities };
}

function isPlatform(value: unknown): value is ChannelSettingsPlatform {
  return value === "twitch" || value === "kick" || value === "youtube";
}

function normalizeOverrides(value: unknown): ChannelSettingsOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const next: ChannelSettingsOverrides = {};
  for (const key of ["saveLiveChat", "notifications", "highlights", "highlightSound", "obsOverlay"] as const) {
    if (typeof source[key] === "boolean") {
      next[key] = source[key];
    }
  }

  if (source.platforms && typeof source.platforms === "object" && !Array.isArray(source.platforms)) {
    const platforms: Partial<Record<ChannelSettingsPlatform, boolean>> = {};
    for (const platform of ["twitch", "kick", "youtube"] as const) {
      if (typeof (source.platforms as Record<string, unknown>)[platform] === "boolean") {
        platforms[platform] = (source.platforms as Record<string, boolean>)[platform];
      }
    }
    if (Object.keys(platforms).length > 0) {
      next.platforms = platforms;
    }
  }

  return next;
}

export function readChannelSettings(): ChannelSettingsMap {
  try {
    const raw = localStorage.getItem(CHANNEL_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: ChannelSettingsMap = {};
    for (const [channelId, value] of Object.entries(parsed)) {
      if (!channelId || !value || typeof value !== "object") {
        continue;
      }
      const normalized = normalizeOverrides(value);
      if (Object.keys(normalized).length > 0) {
        result[channelId] = normalized;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function writeChannelSettings(settings: ChannelSettingsMap) {
  writeSetting(CHANNEL_SETTINGS_KEY, settings);
}

export function channelSettingValue(
  settings: ChannelSettingsMap,
  channelId: string,
  key: keyof Pick<ChannelSettingsOverrides, "saveLiveChat" | "notifications" | "highlights" | "highlightSound" | "obsOverlay">,
  globalValue: boolean
): boolean {
  const override = settings[channelId]?.[key];
  return typeof override === "boolean" ? override : globalValue;
}

export function channelPlatformValue(
  settings: ChannelSettingsMap,
  channelId: string,
  platform: ChannelSettingsPlatform,
  globalValue = true
) {
  const override = settings[channelId]?.platforms?.[platform];
  return typeof override === "boolean" ? override : globalValue;
}

export function hasChannelSettingsOverride(settings: ChannelSettingsMap, channelId: string) {
  return Boolean(settings[channelId] && Object.keys(settings[channelId]).length > 0);
}

export function isChannelSettingsPlatform(value: string): value is ChannelSettingsPlatform {
  return isPlatform(value);
}
