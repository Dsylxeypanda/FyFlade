import { useRef, useState, type ReactNode } from "react";
import { dock, minimumSize, panes, resize, showInbox, type DragItem, type DropSide, type LayoutNode, type Pane, type Split, type WorkspaceLayout } from "./layout";
type Props = { layout: WorkspaceLayout; editing: boolean; no: boolean; name: string; onChange: (layout: WorkspaceLayout) => void; onSave: () => void; onCancel: () => void; onUndo: () => void; canUndo: boolean; onReset: () => void; renderPane: (pane: Pane) => ReactNode; colors: { panel: string; input: string; text: string; muted: string; border: string; accent: string } };
function Divider({ node, onResize, no }: { node: Split; onResize: (ratio: number) => void; no: boolean }) {
  const start = useRef<{ rect: DOMRect; ratio: number } | null>(null);
  const pending = useRef(node.ratio);
  return <div role="separator" aria-label={no ? "Endre panelstørrelse" : "Resize panels"} aria-orientation={node.direction === "horizontal" ? "vertical" : "horizontal"} aria-valuenow={Math.round(node.ratio * 100)} aria-valuemin={15} aria-valuemax={85} tabIndex={0}
    onKeyDown={e => { if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(e.key)) { e.preventDefault(); onResize(node.ratio + (["ArrowLeft", "ArrowUp"].includes(e.key) ? -.05 : .05)); } }}
    onPointerDown={e => { start.current = { rect: e.currentTarget.parentElement!.getBoundingClientRect(), ratio: node.ratio }; pending.current = node.ratio; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={e => { if (!start.current) return; const r = start.current.rect; pending.current = Math.max(.15, Math.min(.85, node.direction === "horizontal" ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height)); e.currentTarget.style.background = "#9147ff"; e.currentTarget.title = `${Math.round(pending.current * 100)} / ${100 - Math.round(pending.current * 100)}`; const parent = e.currentTarget.parentElement!; const a = minimumSize(node.a), b = minimumSize(node.b); parent.style[node.direction === "horizontal" ? "gridTemplateColumns" : "gridTemplateRows"] = `minmax(${node.direction === "horizontal" ? a.width : a.height}px, ${pending.current}fr) 10px minmax(${node.direction === "horizontal" ? b.width : b.height}px, ${1 - pending.current}fr)`; }}
    onPointerUp={e => { if (start.current) { start.current = null; e.currentTarget.releasePointerCapture(e.pointerId); onResize(pending.current); } }}
    onPointerCancel={e => { if (start.current) { onResize(start.current.ratio); start.current = null; e.currentTarget.parentElement!.style[node.direction === "horizontal" ? "gridTemplateColumns" : "gridTemplateRows"] = ""; } }}
    style={{ background: "#73778066", cursor: node.direction === "horizontal" ? "col-resize" : "row-resize", touchAction: "none", minWidth: 10, minHeight: 10 }} />;
}
export function DockWorkspace(props: Props) {
  const { layout, editing, no, colors, onChange } = props;
  const t = (a: string, b: string) => no ? a : b;
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [preview, setPreview] = useState("");
  const [sourceValue, setSourceValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [side, setSide] = useState<DropSide>("right");
  const [confirmReset, setConfirmReset] = useState(false);
  const label = (p: Pane) => p.panel === "chat" ? p.platforms.map(s => s === "youtube" ? "YouTube" : s === "kick" ? "Kick" : "Twitch").join(" + ") : p.panel === "channels" ? t("Kanaler", "Channels") : t("Innboks", "Inbox");
  const sides: [DropSide, string][] = [["left", t("Fest til venstre", "Dock left")], ["right", t("Fest til høyre", "Dock right")], ["top", t("Fest over", "Dock above")], ["bottom", t("Fest under", "Dock below")], ["center", t("Slå sammen", "Combine")]];
  const button = { border: `1px solid ${colors.border}`, borderRadius: 4, background: colors.input, color: colors.text, padding: "5px 8px", font: "inherit", cursor: "pointer" };
  const leaves = panes(layout.root);
  const sources = leaves.flatMap(p => [{ item: { paneId: p.id } as DragItem, title: label(p) }, ...p.platforms.map(platform => ({ item: { paneId: p.id, platform }, title: `${platform} (${label(p)})` }))]);
  const source = sources.find(s => JSON.stringify(s.item) === sourceValue)?.item || sources[0].item;
  const target = leaves.find(p => p.id === targetValue)?.id || leaves[0].id;
  const pointerCleanup = useRef<null | (() => void)>(null);
  const beginPointerDrag = (event: React.PointerEvent, item: DragItem) => {
    if (!editing || event.button !== 0) return;
    event.stopPropagation();
    pointerCleanup.current?.();
    const startX = event.clientX, startY = event.clientY;
    let active = false;
    const move = (moveEvent: PointerEvent) => {
      if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return;
      active = true;
      moveEvent.preventDefault();
      setDrag(item);
      const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
      const zone = element?.closest<HTMLElement>("[data-drop-side]");
      const targetPane = zone?.closest<HTMLElement>("[data-layout-pane]");
      setPreview(zone && targetPane ? `${targetPane.dataset.layoutPane}:${zone.dataset.dropSide}` : "");
    };
    const stop = (upEvent: PointerEvent) => {
      const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
      const zone = active ? element?.closest<HTMLElement>("[data-drop-side]") : null;
      const targetPane = zone?.closest<HTMLElement>("[data-layout-pane]");
      if (zone?.dataset.dropSide && targetPane?.dataset.layoutPane) onChange(dock(layout, item, targetPane.dataset.layoutPane, zone.dataset.dropSide as DropSide));
      pointerCleanup.current?.();
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      if (pointerCleanup.current === cleanup) pointerCleanup.current = null;
      setDrag(null); setPreview("");
    };
    pointerCleanup.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };
  // Pointer events are used deliberately: native HTML drag is unreliable in Windows WebView/Tauri.
  const dragProps = (item: DragItem) => ({ onPointerDown: (e: React.PointerEvent) => beginPointerDrag(e, item) });
  const render = (node: LayoutNode): ReactNode => {
    if (node.kind === "split") {
      const a = minimumSize(node.a), b = minimumSize(node.b), horizontal = node.direction === "horizontal";
      return <div key={node.id} data-layout-split={node.id} style={{ display: "grid", minHeight: 0, minWidth: 0, height: "100%", ...(horizontal ? { gridTemplateColumns: `minmax(${a.width}px, ${node.ratio}fr) ${editing ? 10 : 4}px minmax(${b.width}px, ${1 - node.ratio}fr)` } : { gridTemplateRows: `minmax(${a.height}px, ${node.ratio}fr) ${editing ? 10 : 4}px minmax(${b.height}px, ${1 - node.ratio}fr)` }) }}>
        {render(node.a)}{editing ? <Divider node={node} no={no} onResize={ratio => onChange(resize(layout, node.id, ratio))} /> : <div style={{ background: colors.border }} />}{render(node.b)}
      </div>;
    }
    return <section key={node.id} data-layout-pane={node.id} aria-label={label(node)} style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", background: colors.panel }}>
      <header {...dragProps({ paneId: node.id })} title={editing ? t("Hold og dra hele denne linjen for å flytte panelet", "Hold and drag this whole bar to move the pane") : t("Layout låst", "Layout locked")} style={{ minHeight: 29, padding: 5, background: colors.input, borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, fontSize: 11, cursor: editing ? "grab" : "default", userSelect: "none", touchAction: editing ? "none" : "auto" }}>
        <strong style={{ flex: "1 1 72px", pointerEvents: "none" }}>{editing ? "⠿ " : ""}{node.panel === "chat" ? t("Chat", "Chat") : label(node)}</strong>
        {node.platforms.map(platform => <span key={platform} {...dragProps({ paneId: node.id, platform })} data-layout-platform={platform} title={editing ? t(`Hold og dra hele ${platform}-fanen`, `Hold and drag the whole ${platform} tab`) : undefined} style={{ minHeight: 22, minWidth: 58, display: "inline-grid", placeItems: "center", border: `1px solid ${colors.border}`, padding: "1px 8px", borderRadius: 4, background: colors.panel, cursor: editing ? "grab" : "default", touchAction: editing ? "none" : "auto" }}>{platform === "youtube" ? "YouTube" : platform === "kick" ? "Kick" : "Twitch"}</span>)}
      </header>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "auto" }}>{props.renderPane(node)}</div>
      {editing && drag && <div style={{ position: "absolute", inset: 28, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", gap: 4, zIndex: 8 }}>
        {sides.filter(([s]) => s !== "center" || (node.panel === "chat" && leaves.find(p => p.id === drag.paneId)?.panel === "chat")).map(([s, text]) => <div key={s} data-drop-side={s} onDragOver={e => { e.preventDefault(); e.stopPropagation(); setPreview(`${node.id}:${s}`); e.dataTransfer.dropEffect = "move"; }} onDrop={e => { e.preventDefault(); e.stopPropagation(); onChange(dock(layout, drag, node.id, s)); setDrag(null); setPreview(""); }}
          style={{ display: "grid", placeItems: "center", padding: 4, fontSize: 11, border: `2px solid ${colors.accent}`, background: preview === `${node.id}:${s}` ? colors.accent : colors.input, color: colors.text, gridColumn: s === "left" ? 1 : s === "right" ? 3 : 2, gridRow: s === "top" ? 1 : s === "bottom" ? 3 : 2 }}>{s === "center" ? `${text}: ${label(node)}` : text}</div>)}
      </div>}
    </section>;
  };
  const minimum = minimumSize(layout.root);
  return <div data-layout-workspace style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", color: colors.text }}>
    {editing && <div role="region" aria-label={t("Rediger layout", "Edit layout")} style={{ padding: 8, border: `2px solid ${colors.accent}`, background: colors.panel, fontSize: 11, maxHeight: "42vh", overflowY: "auto", flexShrink: 0 }}>
      <strong>{t("Redigerer layout", "Editing layout")}: {props.name}</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "7px 0" }}>
        <button style={button} onClick={props.onSave}>{t("Lagre layout", "Save layout")}</button><button style={button} onClick={props.onCancel}>{t("Avbryt", "Cancel")}</button><button style={button} disabled={!props.canUndo} onClick={props.onUndo}>{t("Angre", "Undo")}</button><button style={button} onClick={() => setConfirmReset(true)}>{t("Tilbakestill layout", "Reset layout")}</button><button style={button} onClick={props.onSave}>{t("Lagre og lås", "Save and lock")}</button>
      </div>
      {confirmReset && <div role="alert">{t("Tilbakestille denne layouten? Andre innstillinger beholdes.", "Reset this layout? Other settings are kept.")} <button style={button} onClick={() => { props.onReset(); setConfirmReset(false); }}>{t("Bekreft tilbakestilling", "Confirm reset")}</button> <button style={button} onClick={() => setConfirmReset(false)}>{t("Avbryt", "Cancel")}</button></div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}><label><input type="checkbox" checked disabled />{t("Kanaler og status (alltid tilgjengelig)", "Channels and status (always available)")}</label><label><input type="checkbox" checked disabled />Chat</label><label><input type="checkbox" checked={leaves.some(p => p.panel === "inbox")} onChange={e => onChange(showInbox(layout, e.target.checked))} />{t("Innboks", "Inbox")}</label></div>
      <details style={{ marginTop: 6 }}><summary>{t("Flytt uten å dra", "Move without dragging")}</summary><div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
        <select aria-label={t("Flytt panel eller plattform", "Move panel or platform")} style={button} value={JSON.stringify(source)} onChange={e => setSourceValue(e.target.value)}>{sources.map(s => <option key={JSON.stringify(s.item)} value={JSON.stringify(s.item)}>{s.title}</option>)}</select>
        <select aria-label={t("Målpanel", "Target pane")} style={button} value={target} onChange={e => setTargetValue(e.target.value)}>{leaves.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}</select>
        <select aria-label={t("Plassering", "Dock position")} style={button} value={side} onChange={e => setSide(e.target.value as DropSide)}>{sides.map(([s, text]) => <option key={s} value={s}>{text}</option>)}</select><button style={button} onClick={() => onChange(dock(layout, source, target, side))}>{t("Flytt", "Move")}</button>
      </div></details>
    </div>}
    <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}><div style={{ height: "100%", minHeight: minimum.height, minWidth: minimum.width }}>{render(layout.root)}</div></div>
  </div>;
}
