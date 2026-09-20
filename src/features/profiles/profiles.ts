import { validateLayout, type WorkspaceLayout } from "../layout/layout";
// Explicit allowlist: never expand this with account/content or accessibility data.
export type ProfileView = { fontSize: number; tabPosition: "top" | "bottom" | "left" | "right"; tabSize: "compact" | "normal"; inboxOpen: boolean };
export type Profile = { id: string; name: string; view: ProfileView; layout?: WorkspaceLayout | null };
export type ProfileStore = { version: 1; activeId: string; normalBaseline: ProfileView; profiles: Profile[] };
export const PROFILES_KEY = "fyflate.profiles.v1";
export const BUILTIN_IDS = ["normal", "streamer", "moderator", "minimal"] as const;
export const isBuiltin = (id: string) => (BUILTIN_IDS as readonly string[]).includes(id);
export function safeView(value: unknown, fallback: ProfileView): ProfileView {
  const v = (value && typeof value === "object" ? value : {}) as Partial<ProfileView>;
  return { fontSize: typeof v.fontSize === "number" && Number.isFinite(v.fontSize) ? Math.max(10, Math.min(24, Math.round(v.fontSize))) : fallback.fontSize,
    tabPosition: ["top", "bottom", "left", "right"].includes(v.tabPosition || "") ? v.tabPosition! : fallback.tabPosition,
    tabSize: v.tabSize === "compact" || v.tabSize === "normal" ? v.tabSize : fallback.tabSize,
    inboxOpen: typeof v.inboxOpen === "boolean" ? v.inboxOpen : fallback.inboxOpen };
}
export function defaultView(id: string, normal: ProfileView): ProfileView {
  if (id === "streamer") return { fontSize: 15, tabPosition: "right", tabSize: "compact", inboxOpen: true };
  if (id === "moderator") return { fontSize: 12, tabPosition: "left", tabSize: "compact", inboxOpen: true };
  if (id === "minimal") return { fontSize: 13, tabPosition: "top", tabSize: "compact", inboxOpen: false };
  return { ...normal };
}
export function loadProfiles(raw: unknown, current: ProfileView): ProfileStore {
  const saved = raw && typeof raw === "object" && (raw as ProfileStore).version === 1 ? raw as ProfileStore : null;
  const baseline = safeView(saved?.normalBaseline, current);
  const entries = Array.isArray(saved?.profiles) ? saved.profiles : [];
  const profiles: Profile[] = BUILTIN_IDS.map(id => ({ id, name: id, view: safeView(entries.find(p => p?.id === id)?.view, defaultView(id, baseline)), layout: validateLayout(entries.find(p => p?.id === id)?.layout) }));
  for (const p of entries) {
    if (!p || typeof p.id !== "string" || !p.id.startsWith("custom-") || p.id.length > 100 || profiles.some(item => item.id === p.id) || typeof p.name !== "string" || !p.name.trim()) continue;
    profiles.push({ id: p.id, name: p.name.trim().slice(0, 60), view: safeView(p.view, baseline), layout: validateLayout(p.layout) });
  }
  return { version: 1, activeId: profiles.some(p => p.id === saved?.activeId) ? saved!.activeId : "normal", normalBaseline: baseline, profiles };
}
export const sameView = (a: ProfileView, b: ProfileView) => a.fontSize === b.fontSize && a.tabPosition === b.tabPosition && a.tabSize === b.tabSize && a.inboxOpen === b.inboxOpen;
export function profileName(p: Profile, no: boolean): string {
  return isBuiltin(p.id) ? ({ normal: "Normal", streamer: "Streamer", moderator: "Moderator", minimal: no ? "Minimal" : "Minimal" }[p.id] || p.name) : p.name;
}
