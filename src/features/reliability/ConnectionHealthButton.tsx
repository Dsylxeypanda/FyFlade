import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  connectionHealthColor,
  overallConnectionHealth,
  type ConnectionHealthState,
  type PlatformConnectionHealth,
} from "./reliability";
import "./ConnectionHealthButton.css";

const PLATFORM_ORDER: PlatformConnectionHealth["id"][] = [
  "twitch",
  "kick",
  "youtube",
];

type ConnectionHealthButtonProps = {
  items: PlatformConnectionHealth[];
  language: "no" | "en";
  compact: boolean;
  position: "top" | "bottom" | "left" | "right";
  colors: {
    panel: string;
    panelRaised: string;
    tabBar: string;
    text: string;
    muted: string;
    border: string;
  };
  onOpenDiagnostics: () => void;
};

function stateLabel(state: ConnectionHealthState, language: "no" | "en") {
  const labels: Record<ConnectionHealthState, [string, string]> = {
    connected: ["Tilkoblet", "Connected"],
    connecting: ["Kobler til…", "Connecting…"],
    reconnecting: ["Kobler til igjen…", "Reconnecting…"],
    "sign-in": ["Logg inn på nytt", "Sign in again"],
    disconnected: ["Tilkoblingen ble brutt", "Connection lost"],
    unavailable: ["Tjenesten er utilgjengelig", "Service unavailable"],
    "not-connected": ["Ikke tilkoblet", "Not connected"],
    offline: ["Ingen internettilkobling", "No internet connection"],
  };
  return labels[state][language === "no" ? 0 : 1];
}

export function ConnectionHealthButton({
  items, language, compact, position, colors, onOpenDiagnostics,
}: ConnectionHealthButtonProps) {
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ left: 8, top: 8 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupId = useId();
  const headingId = useId();
  const vertical = position === "left" || position === "right";
  const overallColor = connectionHealthColor(overallConnectionHealth(items));
  const orderedItems = [...items].sort(
    (left, right) => PLATFORM_ORDER.indexOf(left.id) - PLATFORM_ORDER.indexOf(right.id)
  );
  const tr = (no: string, en: string) => (language === "no" ? no : en);

  useLayoutEffect(() => {
    if (!open) return;

    const placePopup = () => {
      const anchor = rootRef.current?.getBoundingClientRect();
      const popup = popupRef.current?.getBoundingClientRect();
      if (!anchor || !popup) return;

      const margin = 8;
      const gap = 7;
      const maxLeft = Math.max(margin, window.innerWidth - popup.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - popup.height - margin);
      let left = anchor.right - popup.width;
      let top = anchor.top - popup.height - gap;

      if (position === "left" || position === "right") {
        const besideRight = anchor.right + gap;
        const besideLeft = anchor.left - popup.width - gap;
        left = position === "left" ? besideRight : besideLeft;
        if (left < margin) left = besideRight;
        if (left > maxLeft && besideLeft >= margin) left = besideLeft;
        top = anchor.bottom - popup.height;
      } else if (position === "top") {
        top = anchor.bottom + gap;
        if (top > maxTop && anchor.top - popup.height - gap >= margin) {
          top = anchor.top - popup.height - gap;
        }
      } else if (top < margin && anchor.bottom + gap <= maxTop) {
        top = anchor.bottom + gap;
      }

      const next = {
        left: Math.min(maxLeft, Math.max(margin, left)),
        top: Math.min(maxTop, Math.max(margin, top)),
      };
      setPopupPosition((current) =>
        current.left === next.left && current.top === next.top ? current : next
      );
    };

    placePopup();
    popupRef.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(placePopup);
    if (rootRef.current) observer.observe(rootRef.current);
    if (popupRef.current) observer.observe(popupRef.current);
    window.addEventListener("resize", placePopup);
    window.addEventListener("scroll", placePopup, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", placePopup);
      window.removeEventListener("scroll", placePopup, true);
    };
  }, [open, position, compact, language]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: PointerEvent | FocusEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };

    window.addEventListener("pointerdown", outside);
    window.addEventListener("focusin", outside);
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("focusin", outside);
      window.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={tr("Tilkoblingsstatus", "Connection status")}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 3 : 4,
        flex: vertical ? "1 1 0" : "0 0 auto", minWidth: 0,
        width: vertical ? 0 : compact ? 34 : 40,
        height: "100%",
        padding: vertical ? "0 7px" : 0,
        boxSizing: "border-box",
        background: "transparent",
      }}
    >
      {orderedItems.map((item) => {
        const status = stateLabel(item.state, language);
        const dotColor = connectionHealthColor(item.state);
        return (
          <button
            key={item.id}
            type="button"
            className="connection-health-trigger"
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setOpen((current) => !current);
            }}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={open ? popupId : undefined}
            aria-label={`${item.label}: ${status}. ${item.detail}`}
            title={`${item.label} — ${status}\n${item.detail}`}
            style={{
              flex: "0 0 auto", width: compact ? 10 : 11, height: compact ? 18 : 20,
              minWidth: 10, padding: 0, border: 0, borderRadius: 4,
              background: open ? colors.panel : "transparent", color: colors.text,
              display: "grid", placeItems: "center", cursor: "pointer",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: compact ? 6 : 7, height: compact ? 6 : 7, borderRadius: "50%",
                background: dotColor,
                boxShadow: item.state === "connected"
                  ? `0 0 5px ${dotColor}`
                  : item.state === "reconnecting" || item.state === "connecting"
                    ? `0 0 3px ${dotColor}`
                    : "none",
              }}
            />
          </button>
        );
      })}

      {open && createPortal(
        <div
          ref={popupRef}
          id={popupId}
          role="dialog"
          aria-labelledby={headingId}
          tabIndex={-1}
          style={{
            position: "fixed", ...popupPosition, zIndex: 33000,
            width: "min(285px, calc(100vw - 16px))", maxHeight: "calc(100vh - 16px)",
            boxSizing: "border-box", overflowY: "auto", padding: 7,
            border: `1px solid ${colors.border}`, borderRadius: 8,
            background: colors.panelRaised, color: colors.text, fontFamily: "inherit",
            boxShadow: "0 8px 24px rgba(0,0,0,.35)", outline: "none",
          }}
        >
          <div style={{ padding: "4px 6px 7px", display: "flex", alignItems: "center", gap: 7 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: overallColor }} />
            <strong id={headingId} style={{ fontSize: 11.5 }}>{tr("Tilkoblingsstatus", "Connection status")}</strong>
            <button
              type="button"
              className="connection-health-trigger"
              aria-label={tr("Lukk tilkoblingsstatus", "Close connection status")}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus({ preventScroll: true });
              }}
              style={{ marginLeft: "auto", padding: "1px 5px", border: 0, borderRadius: 3, background: "transparent", color: colors.muted, cursor: "pointer", fontSize: 15 }}
            >×</button>
          </div>

          {orderedItems.map((item) => (
            <div
              key={item.id}
              style={{
                minHeight: 43, padding: "7px 6px", display: "grid",
                gridTemplateColumns: "10px minmax(0, 1fr)", gap: 8, alignItems: "start",
                borderTop: `1px solid ${colors.border}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 7, height: 7, marginTop: 3, borderRadius: "50%",
                  background: connectionHealthColor(item.state),
                  boxShadow: item.state === "connected"
                    ? `0 0 5px ${connectionHealthColor(item.state)}`
                    : "none",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "3px 7px", fontSize: 10.5 }}>
                  <strong style={{ color: colors.text }}>{item.label}</strong>
                  <span style={{ color: colors.text }}>{stateLabel(item.state, language)}</span>
                </div>
                <div style={{ color: colors.muted, fontSize: 9.5, lineHeight: "14px", marginTop: 3, overflowWrap: "anywhere" }}>{item.detail}</div>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="connection-health-trigger"
            onClick={() => { setOpen(false); onOpenDiagnostics(); }}
            style={{
              width: "100%", minHeight: 31, marginTop: 5, padding: "5px 8px",
              border: `1px solid ${colors.border}`, borderRadius: 5,
              background: colors.panel, color: colors.text, fontFamily: "inherit",
              fontSize: 9.5, fontWeight: 750, cursor: "pointer",
            }}
          >{tr("Åpne systemkontroll", "Open system check")} ›</button>
        </div>,
        document.body
      )}
    </div>
  );
}
