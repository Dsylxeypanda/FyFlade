type WhatsNewColors = {
  panel: string;
  panelRaised: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
};

type WhatsNewProps = {
  version: string;
  language: "no" | "en";
  colors: WhatsNewColors;
  onClose: () => void;
  onShowMe: () => void;
  onProfiles: () => void;
};

export function WhatsNew({
  version,
  language,
  colors,
  onClose,
  onShowMe,
  onProfiles,
}: WhatsNewProps) {
  const no = language === "no";
  const buttonStyle = {
    height: 34,
    padding: "0 13px",
    border: `1px solid ${colors.border}`,
    borderRadius: 5,
    background: colors.panelRaised,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 11,
    cursor: "pointer",
  } as const;

  const changes = no
    ? [
      "Profiler: Normal, Streamer, Moderator, Minimal – eller ditt eget oppsett",
      "Lokale kallenavn og tidsbegrenset ignorering",
      "Egne farger, lyder og visuell puls for markerte personer",
      "Bedre innstillingssøk, hjelpeforklaringer og Angre",
      "Gjennomsiktig OBS-overlay og en kort oppstartsintro",
      "Tilkoblingsstatus, systemkontroll og trygg gjenoppretting",
      ]
    : [
      "Profiles: Normal, Streamer, Moderator, Minimal – or your own setup",
      "Local nicknames and timed ignores",
      "Per-person highlight colors, sounds, and visual pulse",
      "Better Settings search, help explanations, and Undo",
      "Transparent OBS overlay and a short startup intro",
      "Connection status, system checks, and safe recovery",
      ];

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 46500, display: "grid", placeItems: "center", padding: 16, background: "rgba(3,5,9,.7)" }}>
      <div style={{ width: 470, maxWidth: "calc(100vw - 32px)", overflow: "hidden", border: `1px solid ${colors.border}`, borderRadius: 9, background: colors.panel, color: colors.text, boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}>
        <div style={{ padding: "18px 19px 14px", borderBottom: `1px solid ${colors.border}`, background: colors.panelRaised }}>
          <div style={{ color: colors.accent, fontSize: 9.5, fontWeight: 850, letterSpacing: ".05em" }}>FyFlade {version}</div>
          <div style={{ marginTop: 5, fontSize: 19, fontWeight: 880 }}>{no ? "Dette er nytt i FyFlade" : "What’s new in FyFlade"}</div>
        </div>
        <div style={{ padding: "15px 19px" }}>
          <div style={{ display: "grid", gap: 9 }}>
            {changes.map((change) => (
              <div key={change} style={{ display: "flex", gap: 9, color: colors.muted, fontSize: 11, lineHeight: "17px" }}>
                <span aria-hidden="true" style={{ color: colors.accent, fontWeight: 950 }}>✓</span>
                <span>{change}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 17 }}>
            <button onClick={onProfiles} style={buttonStyle}>{no ? "Vis profiler" : "Show profiles"}</button>
            <button onClick={onClose} style={buttonStyle}>{no ? "Senere" : "Later"}</button>
            <button onClick={onShowMe} style={{ ...buttonStyle, borderColor: colors.accent, background: colors.accent, color: colors.accentText, fontWeight: 800 }}>{no ? "Vis meg" : "Show me"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
