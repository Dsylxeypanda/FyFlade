type FirstRunStage = "welcome" | "accounts";

type FirstRunColors = {
  panel: string;
  panelRaised: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
};

type FirstRunSetupProps = {
  stage: FirstRunStage;
  language: "no" | "en";
  colors: FirstRunColors;
  status: {
    twitch: boolean;
    kick: boolean;
    youtube: boolean;
  };
  busy: {
    twitch: boolean;
    kick: boolean;
    youtube: boolean;
  };
  kickAvailable: boolean;
  youtubeAvailable: boolean;
  onStart: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onConnectTwitch: () => void;
  onConnectKick: () => void;
  onConnectYouTube: () => void;
};

export function FirstRunSetup({
  stage,
  language,
  colors,
  status,
  busy,
  kickAvailable,
  youtubeAvailable,
  onStart,
  onSkip,
  onContinue,
  onConnectTwitch,
  onConnectKick,
  onConnectYouTube,
}: FirstRunSetupProps) {
  const no = language === "no";
  const primaryButton = {
    height: 36,
    padding: "0 14px",
    border: `1px solid ${colors.accent}`,
    borderRadius: 5,
    background: colors.accent,
    color: colors.accentText,
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  } as const;
  const secondaryButton = {
    ...primaryButton,
    border: `1px solid ${colors.border}`,
    background: colors.panelRaised,
    color: colors.text,
    fontWeight: 650,
  } as const;

  const platformRows = [
    {
      key: "twitch" as const,
      name: "Twitch",
      color: "#9147ff",
      connected: status.twitch,
      waiting: busy.twitch,
      available: true,
      onConnect: onConnectTwitch,
    },
    {
      key: "kick" as const,
      name: "Kick",
      color: "#53fc18",
      connected: status.kick,
      waiting: busy.kick,
      available: kickAvailable,
      onConnect: onConnectKick,
    },
    {
      key: "youtube" as const,
      name: "YouTube",
      color: "#ff0033",
      connected: status.youtube,
      waiting: busy.youtube,
      available: youtubeAvailable,
      onConnect: onConnectYouTube,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 47000,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(3,5,9,.76)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div style={{ width: 520, maxWidth: "calc(100vw - 32px)", border: `1px solid ${colors.border}`, borderRadius: 10, background: colors.panel, color: colors.text, boxShadow: "0 22px 70px rgba(0,0,0,.62)", overflow: "hidden" }}>
        {stage === "welcome" ? (
          <div style={{ padding: "30px 28px 26px", textAlign: "center" }}>
            <img src="/fyflade-logo.png" alt="" style={{ width: 70, height: 70, objectFit: "contain" }} />
            <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900 }}>
              {no ? "Velkommen til FyFlade" : "Welcome to FyFlade"}
            </div>
            <div style={{ width: 400, maxWidth: "100%", margin: "9px auto 0", color: colors.muted, fontSize: 12, lineHeight: "19px" }}>
              {no
                ? "Vi kobler til kontoene du vil bruke, og viser deretter en kort runde gjennom de viktigste funksjonene."
                : "We’ll connect the accounts you want to use, then show a short tour of the most important features."}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 22 }}>
              <button onClick={onSkip} style={secondaryButton}>{no ? "Hopp over" : "Skip"}</button>
              <button onClick={onStart} style={primaryButton}>{no ? "Start gjennomgang" : "Start walkthrough"}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${colors.border}`, background: colors.panelRaised }}>
              <div style={{ fontSize: 18, fontWeight: 850 }}>{no ? "Koble til kontoene dine" : "Connect your accounts"}</div>
              <div style={{ marginTop: 5, color: colors.muted, fontSize: 11, lineHeight: "17px" }}>
                {no ? "Velg bare plattformene du ønsker. Alle kan hoppes over og kobles til senere i Innstillinger." : "Choose only the platforms you want. Each one can be skipped and connected later in Settings."}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, padding: 16 }}>
              {platformRows.map((platform) => (
                <div key={platform.key} style={{ minHeight: 58, display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", border: `1px solid ${colors.border}`, borderRadius: 7, background: colors.panelRaised }}>
                  <span style={{ width: 31, height: 31, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: platform.key === "twitch" ? "50%" : 6, background: platform.color, color: platform.key === "kick" ? "#111" : "#fff", fontSize: 10, fontWeight: 950 }}>
                    {platform.key === "youtube" ? "▶" : platform.key === "twitch" ? "T" : "K"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 12 }}>{platform.name}</strong>
                    <div style={{ marginTop: 3, color: platform.connected ? "#57c76f" : colors.muted, fontSize: 9.5 }}>
                      {platform.connected
                        ? (no ? "Tilkoblet" : "Connected")
                        : platform.waiting
                          ? (no ? "Venter på godkjenning…" : "Waiting for approval…")
                          : !platform.available
                            ? platform.key === "youtube"
                              ? (no ? "Kommer i FyFlade 1.1" : "Coming in FyFlade 1.1")
                              : (no ? "Tjenesten er ikke klar ennå" : "The service is not ready yet")
                            : (no ? "Kan kobles til nå eller senere" : "Connect now or later")}
                    </div>
                  </div>
                  <button
                    disabled={platform.connected || platform.waiting || !platform.available}
                    onClick={platform.onConnect}
                    style={{ ...secondaryButton, minWidth: 92, opacity: platform.connected || platform.waiting || !platform.available ? 0.5 : 1 }}
                  >
                    {platform.connected
                      ? (no ? "Koblet til" : "Connected")
                      : !platform.available && platform.key === "youtube"
                        ? (no ? "Kommer snart" : "Coming soon")
                        : (no ? "Koble til" : "Connect")}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderTop: `1px solid ${colors.border}`, background: colors.panelRaised }}>
              <span style={{ color: colors.muted, fontSize: 9.5 }}>{no ? "Du kan endre dette senere." : "You can change this later."}</span>
              <button onClick={onSkip} style={{ ...secondaryButton, marginLeft: "auto" }}>{no ? "Hopp over alt" : "Skip all"}</button>
              <button onClick={onContinue} style={primaryButton}>{no ? "Fortsett" : "Continue"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export type { FirstRunStage };
