import { useEffect, useMemo, useRef, useState } from "react";
import { COMMAND_GROUPS, filterQuickCommands, type QuickCommand } from "./quickCommands";

type Props = {
  commands: QuickCommand[]; recent: string[]; language: "no" | "en";
  onExecute: (command: QuickCommand) => void; onClose: () => void;
  theme: { panelRaised: string; input: string; text: string; muted: string; border: string; borderStrong: string; accent: string };
};
export function QuickCommandPalette({ commands, recent, language, onExecute, onClose, theme }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const no = language === "no";
  const t = (a: string, b: string) => no ? a : b;
  const labels = { recent: t("Nylig brukt", "Recent"), navigation: t("Navigasjon", "Navigation"), settings: t("Innstillinger", "Settings"), streaming: t("Streaming", "Streaming"), help: t("Hjelp", "Help"), channels: t("Kanaler", "Channels") };
  const groups = useMemo(() => {
    const matches = filterQuickCommands(commands, query);
    const recentCommands = query.trim() ? [] : recent.map(id => matches.find(command => command.id === id)).filter((command): command is QuickCommand => Boolean(command));
    return [{ id: "recent" as const, commands: recentCommands }, ...COMMAND_GROUPS.map(id => ({ id, commands: matches.filter(command => command.group === id && !recentCommands.includes(command)) }))].filter(group => group.commands.length);
  }, [commands, query, recent]);
  const results = groups.flatMap(group => group.commands);
  const selected = Math.min(active, Math.max(0, results.length - 1));
  useEffect(() => setActive(0), [query]);
  useEffect(() => { root.current?.querySelector(`#quick-command-${selected}`)?.scrollIntoView({ block: "nearest" }); }, [selected]);
  const close = () => { onClose(); previousFocus.current?.focus(); };
  const field = { border: `1px solid ${theme.borderStrong}`, background: theme.input, color: theme.text, borderRadius: 6, font: "inherit" };
  return <div onMouseDown={close} style={{ position: "fixed", inset: 0, zIndex: 31500, display: "grid", placeItems: "center", padding: 12, background: "rgba(5,7,10,.62)", backdropFilter: "blur(7px)" }}>
    <div ref={root} role="dialog" aria-modal="true" aria-label={t("Hurtigkommandoer", "Quick Commands")} onMouseDown={e => e.stopPropagation()} style={{ width: "min(640px, calc(100vw - 24px))", boxSizing: "border-box", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden", border: `1px solid ${theme.borderStrong}`, borderRadius: 10, background: theme.panelRaised, color: theme.text, fontSize: 12, boxShadow: "0 24px 70px rgba(0,0,0,.55)" }}
      onKeyDown={e => {
        if (e.key === "Escape" || (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "k")) { e.preventDefault(); e.stopPropagation(); close(); }
        if (e.key === "Tab") {
          const nodes = [...root.current!.querySelectorAll<HTMLElement>('input, button:not([tabindex="-1"])')];
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <div style={{ padding: "12px 14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong>{t("Hva vil du gjøre?", "What do you want to do?")}</strong><button aria-label={t("Lukk hurtigkommandoer", "Close Quick Commands")} onClick={close} style={{ ...field, width: 30, height: 28, cursor: "pointer" }}>×</button></div>
      <input autoFocus role="combobox" aria-label={t("Filtrer kommandoer", "Filter commands")} aria-expanded="true" aria-controls="quick-command-results" aria-autocomplete="list" aria-activedescendant={results.length ? `quick-command-${selected}` : undefined} value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Skriv en handling eller kanal…", "Type an action or channel…")} style={{ ...field, flexShrink: 0, margin: 12, padding: "0 10px", height: 38 }}
        onKeyDown={e => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, Math.min(results.length - 1, selected + (e.key === "ArrowDown" ? 1 : -1)))); }
          if (e.key === "Enter" && !e.nativeEvent.isComposing && results[selected]) { e.preventDefault(); onExecute(results[selected]); }
        }} />
      {!results.length && <p style={{ padding: "12px 16px", color: theme.muted }}>{t("Ingen kommandoer funnet. Prøv et annet søk.", "No commands found. Try another search.")}</p>}
      <div id="quick-command-results" role="listbox" aria-label={t("Kommandoer", "Commands")} style={{ overflowY: "auto", minHeight: 0 }}>
        {groups.map(group => <div key={group.id} role="group" aria-label={labels[group.id]}><div style={{ padding: "10px 14px 4px", fontSize: 10, fontWeight: 800, color: theme.accent, textTransform: "uppercase" }}>{labels[group.id]}</div>{group.commands.map(command => {
          const index = results.indexOf(command);
          return <button key={command.id} id={`quick-command-${index}`} role="option" aria-selected={selected === index} tabIndex={-1} onMouseMove={() => setActive(index)} onClick={() => onExecute(command)} style={{ display: "block", width: "100%", padding: "10px 14px", textAlign: "left", border: 0, borderLeft: `3px solid ${selected === index ? theme.accent : "transparent"}`, background: selected === index ? theme.input : "transparent", color: theme.text, font: "inherit", cursor: "pointer", overflowWrap: "anywhere" }}><strong style={{ fontWeight: 600 }}>{no ? command.titleNo : command.titleEn}</strong>{(command.descriptionNo || command.descriptionEn) && <span style={{ display: "block", marginTop: 3, fontSize: 11, color: theme.muted }}>{no ? command.descriptionNo : command.descriptionEn}</span>}</button>;
        })}</div>)}
      </div>
      <div style={{ padding: "10px 14px", color: theme.muted, fontSize: 10, borderTop: `1px solid ${theme.border}` }}>{t("↑ ↓ velg · Enter utfør · Esc lukk", "↑ ↓ select · Enter run · Esc close")} · Ctrl+K</div>
    </div>
  </div>;
}
