import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { validateLayout, type WorkspaceLayout } from "../layout/layout";
import { readUnknownJsonSetting, writeSetting } from "../../lib/localSettings";
import { defaultView, isBuiltin, loadProfiles, PROFILES_KEY, safeView, sameView, type ProfileStore, type ProfileView } from "./profiles";

export function useProfiles(current: ProfileView, apply: (view: ProfileView) => void, enabled = true) {
  const [store, setStore] = useState(() => loadProfiles(readUnknownJsonSetting(PROFILES_KEY), current));
  const pending = useRef<ProfileView | null>(null);
  const state = useRef(store);
  const receive = useRef<(raw: string) => void>(() => {});
  state.current = store;
  const commit = (next: ProfileStore) => { state.current = next; setStore(next); if (enabled) writeSetting(PROFILES_KEY, next); };
  const restore = (next: ProfileStore) => {
    const view = next.profiles.find(p => p.id === next.activeId)!.view;
    pending.current = view;
    commit(next);
    apply(view);
  };
  receive.current = raw => {
    try { restore(loadProfiles(JSON.parse(raw), current)); } catch { /* Ignore malformed external writes. */ }
  };
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: StorageEvent) => {
      if (event.key === PROFILES_KEY && event.newValue && event.newValue !== JSON.stringify(state.current)) receive.current(event.newValue);
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [enabled]);
  useLayoutEffect(() => { if (enabled) restore(state.current); }, []);
  useEffect(() => {
    if (!enabled) return;
    if (pending.current && !sameView(pending.current, current)) return;
    pending.current = null;
    const previous = state.current;
    if (sameView(previous.profiles.find(p => p.id === previous.activeId)!.view, current)) return;
    commit({ ...previous, profiles: previous.profiles.map(p => p.id === previous.activeId ? { ...p, view: safeView(current, p.view) } : p) });
  }, [current.fontSize, current.tabPosition, current.tabSize, current.inboxOpen, enabled]);
  const switchTo = (id: string) => {
    const previous = state.current;
    if (!previous.profiles.some(p => p.id === id) || id === previous.activeId) return null;
    restore({ ...previous, activeId: id });
    return () => {
      const old = previous.profiles.find(p => p.id === previous.activeId)!;
      const latest = state.current;
      restore({ ...latest, activeId: old.id, profiles: latest.profiles.some(p => p.id === old.id) ? latest.profiles.map(p => p.id === old.id ? old : p) : [...latest.profiles, old] });
    };
  };
  return { store, switchTo,
    setLayout(id: string, layout: WorkspaceLayout | null) {
      const previous = state.current;
      const target = previous.profiles.find(p => p.id === id);
      if (!target) return;
      const clean = validateLayout(layout);
      if (layout && !clean) return;
      commit({ ...previous, profiles: previous.profiles.map(p => p.id === id ? { ...p, layout: clean } : p) });
      return () => commit({ ...state.current, profiles: state.current.profiles.map(p => p.id === id ? { ...p, layout: target.layout } : p) });
    },
    create(name: string, sourceId?: string) {
      if (!name.trim()) return;
      const previous = state.current;
      const source = sourceId ? previous.profiles.find(p => p.id === sourceId)?.view : current;
      if (!source) return;
      const layout = previous.profiles.find(p => p.id === (sourceId || previous.activeId))?.layout;
      const id = `custom-${crypto.randomUUID()}`;
      const profile = { id, name: name.trim().slice(0, 60), view: safeView(source, previous.normalBaseline), layout: validateLayout(layout) };
      restore({ ...previous, activeId: id, profiles: [...previous.profiles, profile] });
    },
    rename(id: string, name: string) { if (!isBuiltin(id) && name.trim()) commit({ ...state.current, profiles: state.current.profiles.map(p => p.id === id ? { ...p, name: name.trim().slice(0, 60) } : p) }); },
    remove(id: string) {
      if (isBuiltin(id)) return;
      const previous = state.current;
      const next = { ...previous, activeId: previous.activeId === id ? "normal" : previous.activeId, profiles: previous.profiles.filter(p => p.id !== id) };
      if (previous.activeId === id) restore(next); else commit(next);
      return () => {
        const removed = previous.profiles.find(p => p.id === id);
        if (!removed) return;
        const latest = state.current;
        const restored = { ...latest, profiles: [...latest.profiles.filter(p => p.id !== id), removed] };
        if (previous.activeId === id) restore({ ...restored, activeId: id }); else commit(restored);
      };
    },
    reset(id: string) {
      if (!isBuiltin(id)) return;
      const previous = state.current;
      const next = { ...previous, profiles: previous.profiles.map(p => p.id === id ? { ...p, view: defaultView(id, previous.normalBaseline), layout: null } : p) };
      if (previous.activeId === id) restore(next); else commit(next);
      return () => {
        const old = previous.profiles.find(p => p.id === id)!;
        const latest = state.current;
        const restored = { ...latest, profiles: latest.profiles.map(p => p.id === id ? old : p) };
        if (latest.activeId === id) restore(restored); else commit(restored);
      };
    },
  };
}
