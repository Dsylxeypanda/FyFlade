import {
  readUnknownJsonSetting,
  writeSettingDebounced,
} from "../../lib/localSettings";

export const OBS_OVERLAY_SETTINGS_KEY =
  "fyflate.obsOverlay.settings.v1";

export type ObsOverlaySettings = {
  enabled: boolean;
  transparentBackground: boolean;
  showUsername: boolean;
  showBadges: boolean;
  showPlatformIcon: boolean;
  fontSize: number;
  textOutline: boolean;
  messageFadeSeconds: number;
  fadeAnimation: boolean;
  entranceAnimation: "none" | "fade" | "slide" | "pop";
  hideBots: boolean;
  hideCommands: boolean;
  maximumMessages: number;
  selectedChannelId: string;
  platforms: {
    twitch: boolean;
    kick: boolean;
    youtube: boolean;
  };
};

export const DEFAULT_OBS_OVERLAY_SETTINGS: ObsOverlaySettings = {
  enabled: false,
  transparentBackground: true,
  showUsername: true,
  showBadges: true,
  showPlatformIcon: true,
  fontSize: 22,
  textOutline: true,
  messageFadeSeconds: 30,
  fadeAnimation: true,
  entranceAnimation: "slide",
  hideBots: true,
  hideCommands: true,
  maximumMessages: 8,
  selectedChannelId: "active",
  platforms: {
    twitch: true,
    kick: true,
    youtube: true,
  },
};

function clamp(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.round(number)))
    : fallback;
}

export function normalizeObsOverlaySettings(
  value: unknown
): ObsOverlaySettings {
  const record =
    value && typeof value === "object"
      ? value as Partial<ObsOverlaySettings>
      : {};
  const platforms =
    record.platforms && typeof record.platforms === "object"
      ? record.platforms
      : DEFAULT_OBS_OVERLAY_SETTINGS.platforms;

  return {
    enabled:
      typeof record.enabled === "boolean"
        ? record.enabled
        : DEFAULT_OBS_OVERLAY_SETTINGS.enabled,
    transparentBackground:
      typeof record.transparentBackground === "boolean"
        ? record.transparentBackground
        : DEFAULT_OBS_OVERLAY_SETTINGS.transparentBackground,
    showUsername:
      typeof record.showUsername === "boolean"
        ? record.showUsername
        : DEFAULT_OBS_OVERLAY_SETTINGS.showUsername,
    showBadges:
      typeof record.showBadges === "boolean"
        ? record.showBadges
        : DEFAULT_OBS_OVERLAY_SETTINGS.showBadges,
    showPlatformIcon:
      typeof record.showPlatformIcon === "boolean"
        ? record.showPlatformIcon
        : DEFAULT_OBS_OVERLAY_SETTINGS.showPlatformIcon,
    fontSize: clamp(
      record.fontSize,
      12,
      48,
      DEFAULT_OBS_OVERLAY_SETTINGS.fontSize
    ),
    textOutline:
      typeof record.textOutline === "boolean"
        ? record.textOutline
        : DEFAULT_OBS_OVERLAY_SETTINGS.textOutline,
    messageFadeSeconds: clamp(
      record.messageFadeSeconds,
      0,
      300,
      DEFAULT_OBS_OVERLAY_SETTINGS.messageFadeSeconds
    ),
    fadeAnimation:
      typeof record.fadeAnimation === "boolean"
        ? record.fadeAnimation
        : DEFAULT_OBS_OVERLAY_SETTINGS.fadeAnimation,
    entranceAnimation:
      record.entranceAnimation === "none" || record.entranceAnimation === "fade" || record.entranceAnimation === "pop"
        ? record.entranceAnimation
        : "slide",
    hideBots:
      typeof record.hideBots === "boolean"
        ? record.hideBots
        : DEFAULT_OBS_OVERLAY_SETTINGS.hideBots,
    hideCommands:
      typeof record.hideCommands === "boolean"
        ? record.hideCommands
        : DEFAULT_OBS_OVERLAY_SETTINGS.hideCommands,
    maximumMessages: clamp(
      record.maximumMessages,
      1,
      50,
      DEFAULT_OBS_OVERLAY_SETTINGS.maximumMessages
    ),
    selectedChannelId:
      typeof record.selectedChannelId === "string" &&
      record.selectedChannelId.trim()
        ? record.selectedChannelId
        : "active",
    platforms: {
      twitch:
        typeof platforms.twitch === "boolean"
          ? platforms.twitch
          : true,
      kick:
        typeof platforms.kick === "boolean"
          ? platforms.kick
          : true,
      youtube:
        typeof platforms.youtube === "boolean"
          ? platforms.youtube
          : true,
    },
  };
}

export function readObsOverlaySettings() {
  return normalizeObsOverlaySettings(
    readUnknownJsonSetting(
      OBS_OVERLAY_SETTINGS_KEY
    )
  );
}

export function saveObsOverlaySettings(
  settings: ObsOverlaySettings
) {
  writeSettingDebounced(
    OBS_OVERLAY_SETTINGS_KEY,
    settings,
    160
  );
}
