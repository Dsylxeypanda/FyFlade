import type { SettingsSectionId } from "./settingsSearch";

export const SETTINGS_NAV_ORDER_KEY = "fyflade.settings.navigationOrder.v1";

export const DEFAULT_SETTINGS_NAV_ORDER: SettingsSectionId[] = [
  "general",
  "profiles",
  "accounts",
  "usage",
  "obs",
  "emotes",
  "chat",
  "tabs",
  "highlights",
  "ignores",
  "privacy",
  "appearance",
  "help",
];

export function normalizeSettingsNavOrder(value: unknown): SettingsSectionId[] {
  const supported = new Set<SettingsSectionId>(DEFAULT_SETTINGS_NAV_ORDER);
  const seen = new Set<SettingsSectionId>();
  const result: SettingsSectionId[] = [];

  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (typeof candidate !== "string") continue;
      const section = candidate as SettingsSectionId;
      if (!supported.has(section) || seen.has(section)) continue;
      seen.add(section);
      result.push(section);
    }
  }

  for (const section of DEFAULT_SETTINGS_NAV_ORDER) {
    if (!seen.has(section)) result.push(section);
  }

  return result;
}

export function readSettingsNavOrder(): SettingsSectionId[] {
  try {
    const raw = localStorage.getItem(SETTINGS_NAV_ORDER_KEY);
    return normalizeSettingsNavOrder(raw ? JSON.parse(raw) : null);
  } catch {
    return [...DEFAULT_SETTINGS_NAV_ORDER];
  }
}

export function writeSettingsNavOrder(order: SettingsSectionId[]) {
  localStorage.setItem(
    SETTINGS_NAV_ORDER_KEY,
    JSON.stringify(normalizeSettingsNavOrder(order))
  );
}

export function moveSettingsSection(
  order: SettingsSectionId[],
  source: SettingsSectionId,
  target: SettingsSectionId
): SettingsSectionId[] {
  const normalized = normalizeSettingsNavOrder(order);
  const sourceIndex = normalized.indexOf(source);
  const targetIndex = normalized.indexOf(target);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return normalized;
  }

  const next = [...normalized];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}
