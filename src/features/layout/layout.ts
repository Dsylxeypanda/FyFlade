export type Platform = "twitch" | "kick" | "youtube";
export const PLATFORMS: Platform[] = ["twitch", "kick", "youtube"];
export type Pane = { kind: "pane"; id: string; panel: "chat" | "channels" | "inbox"; platforms: Platform[] };
export type Split = { kind: "split"; id: string; direction: "horizontal" | "vertical"; ratio: number; a: LayoutNode; b: LayoutNode };
export type LayoutNode = Pane | Split;
export type WorkspaceLayout = { version: 1; root: LayoutNode };
export type DropSide = "left" | "right" | "top" | "bottom" | "center";
export type DragItem = { paneId: string; platform?: Platform };
const id = () => `layout-${crypto.randomUUID()}`;
const pane = (panel: Pane["panel"], platforms: Platform[] = []): Pane => ({ kind: "pane", id: id(), panel, platforms });
export const panes = (node: LayoutNode): Pane[] => node.kind === "pane" ? [node] : [...panes(node.a), ...panes(node.b)];
const split = (a: LayoutNode, b: LayoutNode, direction: Split["direction"], ratio = .5): Split => ({ kind: "split", id: id(), direction, ratio, a, b });
export function defaultLayout(view: { tabPosition: string; inboxOpen: boolean }): WorkspaceLayout {
  let chat: LayoutNode = pane("chat", [...PLATFORMS]);
  if (view.inboxOpen) chat = split(chat, pane("inbox"), "horizontal", .7);
  const tabs = pane("channels"), before = view.tabPosition === "left" || view.tabPosition === "top";
  return { version: 1, root: split(before ? tabs : chat, before ? chat : tabs, view.tabPosition === "left" || view.tabPosition === "right" ? "horizontal" : "vertical", before ? .2 : .8) };
}
// Layout definitions contain presentation only; no channel IDs, accounts or messages.
export function validateLayout(raw: unknown): WorkspaceLayout | null {
  try {
    if (!raw || typeof raw !== "object" || (raw as WorkspaceLayout).version !== 1) return null;
    const ids = new Set<string>(); let count = 0;
    const read = (value: unknown, depth: number): LayoutNode => {
      if (!value || typeof value !== "object" || depth > 8 || ++count > 11) throw Error();
      const n = value as LayoutNode;
      if (typeof n.id !== "string" || !n.id || n.id.length > 100 || ids.has(n.id)) throw Error();
      ids.add(n.id);
      if (n.kind === "split") {
        if (!["horizontal", "vertical"].includes(n.direction) || !Number.isFinite(n.ratio) || n.ratio < .15 || n.ratio > .85) throw Error();
        return { kind: "split", id: n.id, direction: n.direction, ratio: n.ratio, a: read(n.a, depth + 1), b: read(n.b, depth + 1) };
      }
      if (n.kind !== "pane" || !["chat", "channels", "inbox"].includes(n.panel) || !Array.isArray(n.platforms)) throw Error();
      if (n.panel === "chat" ? !n.platforms.length || n.platforms.some(p => !PLATFORMS.includes(p)) : n.platforms.length !== 0) throw Error();
      return { kind: "pane", id: n.id, panel: n.panel, platforms: [...n.platforms] };
    };
    const root = read((raw as WorkspaceLayout).root, 0), leaves = panes(root);
    const sources = leaves.flatMap(p => p.platforms);
    if (leaves.filter(p => p.panel === "channels").length !== 1 || leaves.filter(p => p.panel === "inbox").length > 1 || sources.length !== 3 || new Set(sources).size !== 3) return null;
    return { version: 1, root };
  } catch { return null; }
}
function replace(node: LayoutNode, target: string, change: (n: LayoutNode) => LayoutNode | null): LayoutNode | null {
  if (node.id === target) return change(node);
  if (node.kind === "pane") return node;
  const a = replace(node.a, target, change), b = replace(node.b, target, change);
  return !a ? b : !b ? a : { ...node, a, b };
}
export function dock(layout: WorkspaceLayout, item: DragItem, targetId: string, side: DropSide): WorkspaceLayout {
  const source = panes(layout.root).find(p => p.id === item.paneId), target = panes(layout.root).find(p => p.id === targetId);
  if (!source || !target || (item.platform && !source.platforms.includes(item.platform))) return layout;
  if (source.id === target.id && (!item.platform || source.platforms.length === 1 || side === "center")) return layout;
  if (side === "center" && (source.panel !== "chat" || target.panel !== "chat")) return layout;
  const moving: Pane = item.platform ? pane("chat", [item.platform]) : source;
  const without = replace(layout.root, source.id, () => item.platform && source.platforms.length > 1 ? { ...source, platforms: source.platforms.filter(p => p !== item.platform) } : null);
  if (!without) return layout;
  const root = replace(without, targetId, current => {
    if (current.kind !== "pane") return current;
    if (side === "center") return { ...current, platforms: [...current.platforms, ...moving.platforms] };
    const before = side === "left" || side === "top";
    return split(before ? moving : current, before ? current : moving, side === "left" || side === "right" ? "horizontal" : "vertical");
  });
  return validateLayout({ version: 1, root }) || layout;
}
export function resize(layout: WorkspaceLayout, splitId: string, ratio: number): WorkspaceLayout {
  if (!Number.isFinite(ratio)) return layout;
  const root = replace(layout.root, splitId, n => n.kind === "split" ? { ...n, ratio: Math.max(.15, Math.min(.85, ratio)) } : n);
  return validateLayout({ version: 1, root }) || layout;
}
export function showInbox(layout: WorkspaceLayout, visible: boolean): WorkspaceLayout {
  const existing = panes(layout.root).find(p => p.panel === "inbox");
  if (visible === !!existing) return layout;
  const root = visible ? split(layout.root, pane("inbox"), "horizontal", .7) : replace(layout.root, existing!.id, () => null);
  return validateLayout({ version: 1, root }) || layout;
}
export function minimumSize(node: LayoutNode): { width: number; height: number } {
  if (node.kind === "pane") return { width: node.panel === "channels" ? 130 : 220, height: node.panel === "channels" ? 80 : 150 };
  const a = minimumSize(node.a), b = minimumSize(node.b);
  return node.direction === "horizontal" ? { width: a.width + b.width + 10, height: Math.max(a.height, b.height) } : { width: Math.max(a.width, b.width), height: a.height + b.height + 10 };
}
