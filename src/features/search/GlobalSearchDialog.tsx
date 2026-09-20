import { useEffect, useRef, useState } from "react";
import { SEARCH_CATEGORIES, type SearchDocument, type SearchPlatform } from "./globalSearch";

type Props = {
  language: "no" | "en"; query: string; onQuery: (value: string) => void;
  results: SearchDocument[]; onSelect: (result: SearchDocument) => void; onClose: () => void;
  platform: "all" | SearchPlatform; onPlatform: (value: "all" | SearchPlatform) => void;
  channel: string; onChannel: (value: string) => void; channels: { id: string; name: string }[];
  historyStatus: "loading" | "ready" | "unavailable"; onMore: () => void;
  onSettings: () => void; onInbox: () => void;
  theme: { panel: string; panelRaised: string; input: string; text: string; muted: string; border: string; borderStrong: string; accent: string };
};

export function GlobalSearchDialog(props: Props) {
  const { query, results, theme, onSelect, onClose } = props;
  const no = props.language === "no";
  const t = (a: string, b: string) => no ? a : b;
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    return () => { if (document.activeElement === document.body) previousFocus.current?.focus(); };
  }, []);
  useEffect(() => setActive(0), [query, props.platform, props.channel]);
  const selected = Math.min(active, Math.max(0, results.length - 1));
  useEffect(() => { root.current?.querySelector(`#global-result-${selected}`)?.scrollIntoView({ block: "nearest" }); }, [selected]);
  const field = { height: 36, minWidth: 0, border: `1px solid ${theme.borderStrong}`, borderRadius: 6, background: theme.input, color: theme.text, padding: "0 10px", font: "inherit" };
  const button = { ...field, cursor: "pointer" };
  const names = { channels: t("Kanaler", "Channels"), users: t("Brukere og kallenavn", "Users and nicknames"), messages: t("Meldinger", "Messages"), settings: t("Innstillinger", "Settings"), help: t("Hjelp", "Help") };
  return <div style={{ position: "fixed", inset: 0, zIndex: 31000, display: "grid", placeItems: "start center", padding: "6vh 12px", background: "rgba(5,7,10,.62)", backdropFilter: "blur(7px)" }} onMouseDown={onClose}>
    <div ref={root} role="dialog" aria-modal="true" aria-label={t("Søk i FyFlade", "Search FyFlade")} onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onClose(); }
        if (e.key === "Tab") {
          const focusable = [...root.current!.querySelectorAll<HTMLElement>('input, select, button:not([tabindex="-1"])')].filter(node => !node.hasAttribute("disabled"));
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}
      style={{ width: "min(720px, calc(100vw - 24px))", minWidth: 0, boxSizing: "border-box", maxHeight: "86vh", display: "flex", flexDirection: "column", background: theme.panelRaised, color: theme.text, border: `1px solid ${theme.borderStrong}`, borderRadius: 10, boxShadow: "0 24px 70px rgba(0,0,0,.55)", overflow: "hidden", fontSize: 12 }}>
      <div style={{ display: "flex", gap: 8, padding: 12 }}>
        <input autoFocus role="combobox" aria-label={t("Søk i FyFlade", "Search FyFlade")} aria-controls="global-search-results" aria-expanded="true" aria-autocomplete="list" aria-activedescendant={results.length ? `global-result-${selected}` : undefined} value={query} onChange={e => props.onQuery(e.target.value)} placeholder={t("Søk i FyFlade…", "Search FyFlade…")} style={{ ...field, flex: 1 }}
          onKeyDown={e => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, Math.min(results.length - 1, selected + (e.key === "ArrowDown" ? 1 : -1)))); }
            if (e.key === "Enter" && !e.nativeEvent.isComposing && results[selected]) { e.preventDefault(); onSelect(results[selected]); }
          }} />
        <button aria-label={t("Lukk søk", "Close search")} onClick={onClose} style={button}>×</button>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 12px 10px", flexWrap: "wrap" }}>
        <select aria-label={t("Søkeplattform", "Search platform")} value={props.platform} onChange={e => props.onPlatform(e.target.value as Props["platform"])} style={{ ...field, flex: 1 }}><option value="all">{t("Alle plattformer", "All platforms")}</option><option value="twitch">Twitch</option><option value="kick">Kick</option><option value="youtube">YouTube</option></select>
        <select aria-label={t("Søkekanal", "Search channel")} value={props.channel} onChange={e => props.onChannel(e.target.value)} style={{ ...field, flex: 1 }}><option value="all">{t("Alle kanaler", "All channels")}</option>{props.channels.map(channel => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select>
      </div>
      <div aria-live="polite" style={{ color: theme.muted, padding: "6px 12px", borderBlock: `1px solid ${theme.border}`, fontSize: 11 }}>
        {props.historyStatus === "loading" ? t("Henter lokal historikk…", "Loading local history…") : props.historyStatus === "unavailable" ? t("Lagret historikk er ikke tilgjengelig akkurat nå. Du kan fortsatt søke i appen.", "Saved history is unavailable right now. You can still search the app.") : t("Søker lokalt. Meldinger fra siste 24 timer, opptil 5 000 nyere meldinger.", "Local search. Messages from the last 24 hours, up to 5,000 recent messages.")}
      </div>
      {!query.trim() && <div style={{ padding: 14 }}><p style={{ marginTop: 0, color: theme.muted }}>{t("Finn kanaler, personer, meldinger og innstillinger.", "Find channels, people, messages and settings.")}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{props.channels.slice(0, 3).map(channel => <button key={channel.id} style={button} onClick={() => onSelect({ id: channel.id, category: "channels", title: channel.name, description: "", names: [], searchable: "", target: { kind: "channel", channelId: channel.id } })}>{channel.name}</button>)}<button style={button} onClick={props.onSettings}>{t("Innstillinger", "Settings")}</button><button style={button} onClick={props.onInbox}>{t("Innboks", "Inbox")}</button></div></div>}
      {query.trim() && !results.length && <div style={{ padding: 24 }}><strong>{t("Ingen treff", "No results")}</strong><p style={{ color: theme.muted }}>{t("Prøv et annet søk eller fjern filtrene.", "Try another search or clear the filters.")}</p></div>}
      <div id="global-search-results" role="listbox" aria-label={t("Søkeresultater", "Search results")} style={{ minHeight: 0, overflowY: "auto" }}>
        {SEARCH_CATEGORIES.map(category => {
          const group = results.filter(result => result.category === category);
          if (!group.length) return null;
          return <div key={category} role="group" aria-label={names[category]}><div style={{ padding: "12px 14px 5px", color: theme.accent, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{names[category]}</div>{group.map(result => {
            const position = results.indexOf(result);
            return <button id={`global-result-${position}`} key={result.id} role="option" aria-selected={position === selected} tabIndex={-1} onMouseMove={() => setActive(position)} onClick={() => onSelect(result)} style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: 0, borderLeft: `3px solid ${position === selected ? theme.accent : "transparent"}`, background: position === selected ? theme.input : "transparent", color: theme.text, font: "inherit", cursor: "pointer" }}><span style={{ display: "block", fontWeight: 650, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{result.title}</span><span style={{ display: "block", marginTop: 4, fontSize: 11, color: theme.muted, overflowWrap: "anywhere" }}>{result.description}</span></button>;
          })}</div>;
        })}
      </div>
      {!!results.length && <div style={{ padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: `1px solid ${theme.border}` }}><span style={{ color: theme.muted, fontSize: 10 }}>{t("↑ ↓ velg · Enter åpne · Esc lukk", "↑ ↓ select · Enter open · Esc close")}</span><button style={button} onClick={props.onMore}>{t("Vis flere treff", "Show more results")}</button></div>}
    </div>
  </div>;
}
