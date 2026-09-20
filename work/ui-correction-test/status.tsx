import React from "react";
import { createRoot } from "react-dom/client";
import { ConnectionHealthButton } from "../../src/features/reliability/ConnectionHealthButton";
import type { ConnectionHealthState, PlatformConnectionHealth } from "../../src/features/reliability/reliability";

const query = new URLSearchParams(location.search);
const position = (query.get("position") || "right") as "left" | "right" | "top" | "bottom";
const language = (query.get("language") || "en") as "en" | "no";
const states = (query.get("states") || "connected,reconnecting,sign-in").split(",") as ConnectionHealthState[];
const platforms = ["twitch", "kick", "youtube"] as const;
const items: PlatformConnectionHealth[] = platforms.map((id, index) => ({ id, label: ["Twitch", "Kick", "YouTube"][index], state: states[index], detail: language === "no" ? "Isolert testforklaring" : "Isolated fixture explanation" }));
const vertical = position === "left" || position === "right";
createRoot(document.getElementById("root")!).render(
  <div style={{ position: "fixed", [position]: 0, ...(vertical ? { bottom: 0, width: 116 } : { right: 0, height: 28 }), display: "flex", height: 28, background: "#151619" }}>
    <ConnectionHealthButton items={items} language={language} compact position={position} colors={{ panel: "#16171a", panelRaised: "#242528", tabBar: "#151619", text: "#eeeeee", muted: "#ababab", border: "#383a40" }} onOpenDiagnostics={() => document.body.setAttribute("data-diagnostics-opened", "true")} />
    <button aria-label="Settings" style={{ width: 28, flexShrink: 0, color: "#ccc", background: "#151619", border: 0 }}>⚙</button>
  </div>
);
