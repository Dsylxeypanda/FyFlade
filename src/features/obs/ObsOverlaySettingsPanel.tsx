import type { ObsOverlaySettings } from "./overlaySettings";

type OverlayChannelOption = {
  id: string;
  name: string;
};

type OverlayColors = {
  panel: string;
  panelRaised: string;
  input: string;
  text: string;
  muted: string;
  subtle: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentText: string;
};

type Props = {
  language: "no" | "en";
  settings: ObsOverlaySettings;
  channels: OverlayChannelOption[];
  serverStatus: "starting" | "ready" | "error";
  overlayUrl: string;
  copyStatus: string;
  colors: OverlayColors;
  onUpdate: (update: Partial<ObsOverlaySettings>) => void;
  onTogglePlatform: (
    platform: "twitch" | "kick" | "youtube",
    enabled: boolean
  ) => void;
  onCopy: () => void;
  onPreview: () => void;
  onTestMessage: () => void;
};

export function ObsOverlaySettingsPanel({
  language,
  settings,
  channels,
  serverStatus,
  overlayUrl,
  copyStatus,
  colors,
  onUpdate,
  onTogglePlatform,
  onCopy,
  onPreview,
  onTestMessage,
}: Props) {
  const no = language === "no";
  const ui = (norwegian: string, english: string) =>
    no ? norwegian : english;
  const buttonStyle = {
    minHeight: 32,
    padding: "0 10px",
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 5,
    background: colors.input,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 10,
    cursor: "pointer",
  } as const;
  const inputStyle = {
    height: 34,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 5,
    background: colors.input,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 10.5,
    outline: "none",
  } as const;
  const cardStyle = {
    padding: 12,
    border: `1px solid ${colors.border}`,
    borderRadius: 7,
    background: colors.panel,
  } as const;

  return (
    <div data-tutorial-id="settings-obs" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 850 }}>{ui("OBS-overlay", "OBS overlay")}</div>
          <div style={{ marginTop: 4, color: colors.muted, fontSize: 10.5, lineHeight: "16px" }}>
            {ui(
              "En ren chatvisning for OBS Browser Source. Kontoer, innlogging og vanlige FyFlade-knapper vises aldri i overlayen.",
              "A clean chat display for an OBS Browser Source. Accounts, sign-in data, and normal FyFlade controls never appear in the overlay."
            )}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, color: settings.enabled ? "#57c76f" : colors.muted, fontSize: 10.5, fontWeight: 750, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => onUpdate({ enabled: event.target.checked })}
          />
          {settings.enabled ? ui("På", "On") : ui("Av", "Off")}
        </label>
      </div>

      <div style={{ ...cardStyle, marginTop: 13 }}>
        <strong style={{ fontSize: 12 }}>{ui("Adresse til OBS Browser Source", "OBS Browser Source address")}</strong>
        <div style={{ marginTop: 5, color: colors.muted, fontSize: 9.5, lineHeight: "15px" }}>
          {ui(
            "I OBS: Kilder → + → Nettleser. Lim inn adressen, og bruk for eksempel 700 × 900 som størrelse.",
            "In OBS: Sources → + → Browser. Paste the address and use, for example, 700 × 900 as the size."
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 9 }}>
          <input
            readOnly
            value={overlayUrl}
            onFocus={(event) => event.currentTarget.select()}
            style={{ ...inputStyle, flex: "1 1 330px", minWidth: 220, padding: "0 9px", fontFamily: "monospace" }}
          />
          <button disabled={serverStatus !== "ready"} onClick={onCopy} style={{ ...buttonStyle, opacity: serverStatus === "ready" ? 1 : .5 }}>
            {ui("Kopier", "Copy")}
          </button>
          <button disabled={serverStatus !== "ready"} onClick={onPreview} style={{ ...buttonStyle, opacity: serverStatus === "ready" ? 1 : .5 }}>
            {ui("Forhåndsvis", "Preview")} ↗
          </button>
        </div>
        <div style={{ marginTop: 7, color: serverStatus === "error" ? "#ff8d86" : settings.enabled ? "#57c76f" : colors.subtle, fontSize: 9.5, lineHeight: "14px" }}>
          {serverStatus === "error"
            ? ui("Den lokale OBS-tjenesten kunne ikke starte. Port 17173 kan være i bruk.", "The local OBS service could not start. Port 17173 may already be in use.")
            : serverStatus === "starting"
              ? ui("Starter lokal OBS-tjeneste…", "Starting local OBS service…")
              : settings.enabled
                ? ui("Overlayen er klar mens FyFlade kjører.", "The overlay is ready while FyFlade is running.")
                : ui("Slå på overlayen før den legges inn i OBS.", "Enable the overlay before adding it to OBS.")}
          {copyStatus ? ` · ${copyStatus}` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9, marginTop: 9 }}>
        <div style={cardStyle}>
          <strong style={{ fontSize: 11.5 }}>{ui("Kanal og plattformer", "Channel and platforms")}</strong>
          <label style={{ display: "block", marginTop: 9, color: colors.muted, fontSize: 9.5 }}>
            {ui("Kanal", "Channel")}
            <select
              value={settings.selectedChannelId}
              onChange={(event) => onUpdate({ selectedChannelId: event.target.value })}
              style={{ ...inputStyle, width: "100%", marginTop: 4, padding: "0 8px" }}
            >
              <option value="active">{ui("Følg aktiv kanal", "Follow active channel")}</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
          </label>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {(["twitch", "kick", "youtube"] as const).map((platform) => (
              <label key={platform} style={{ display: "flex", alignItems: "center", gap: 7, color: colors.text, fontSize: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings.platforms[platform]}
                  onChange={(event) => onTogglePlatform(platform, event.target.checked)}
                />
                {platform === "youtube" ? "YouTube" : platform[0].toUpperCase() + platform.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <strong style={{ fontSize: 11.5 }}>{ui("Hva som vises", "Visible content")}</strong>
          <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
            {[
              ["transparentBackground", ui("Helt gjennomsiktig bakgrunn", "Fully transparent background")],
              ["showUsername", ui("Brukernavn", "Username")],
              ["showBadges", ui("Badges og 7TV-badge", "Badges and 7TV badge")],
              ["showPlatformIcon", ui("Plattformikon", "Platform icon")],
              ["textOutline", ui("Tekstkant / skygge", "Text outline / shadow")],
              ["fadeAnimation", ui("Rolig fade-animasjon", "Subtle fade animation")],
            ].map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, color: colors.text, fontSize: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(settings[key as keyof ObsOverlaySettings])}
                  onChange={(event) => onUpdate({ [key]: event.target.checked } as Partial<ObsOverlaySettings>)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 9 }}>
        <strong style={{ fontSize: 11.5 }}>{ui("Størrelse og fading", "Size and fading")}</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 10 }}>
          <label style={{ color: colors.muted, fontSize: 9.5 }}>
            {ui("Tekststørrelse", "Font size")} · {settings.fontSize}px
            <input type="range" min={12} max={48} value={settings.fontSize} onChange={(event) => onUpdate({ fontSize: Number(event.target.value) })} style={{ width: "100%", marginTop: 8, accentColor: colors.accent }} />
          </label>
          <label style={{ color: colors.muted, fontSize: 9.5 }}>
            {ui("Maks meldinger", "Maximum messages")} · {settings.maximumMessages}
            <input type="range" min={1} max={30} value={settings.maximumMessages} onChange={(event) => onUpdate({ maximumMessages: Number(event.target.value) })} style={{ width: "100%", marginTop: 8, accentColor: colors.accent }} />
          </label>
          <label style={{ color: colors.muted, fontSize: 9.5 }}>
            {ui("Forsvinn etter", "Fade after")} · {settings.messageFadeSeconds === 0 ? ui("aldri", "never") : `${settings.messageFadeSeconds}s`}
            <input type="range" min={0} max={120} step={5} value={settings.messageFadeSeconds} onChange={(event) => onUpdate({ messageFadeSeconds: Number(event.target.value) })} style={{ width: "100%", marginTop: 8, accentColor: colors.accent }} />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <button onClick={onTestMessage} disabled={serverStatus !== "ready"} style={{ ...buttonStyle, opacity: serverStatus === "ready" ? 1 : .5 }}>
          ✦ {ui("Vis testmelding", "Show test message")}
        </button>
        <button onClick={onPreview} disabled={serverStatus !== "ready"} style={{ ...buttonStyle, borderColor: colors.accent, background: colors.accent, color: colors.accentText, fontWeight: 800, opacity: serverStatus === "ready" ? 1 : .5 }}>
          {ui("Åpne forhåndsvisning", "Open preview")} ↗
        </button>
      </div>
    </div>
  );
}
