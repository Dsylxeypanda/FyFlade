import type { PartyModeSettings, PartyStyle } from "./partyMode";

type Colors = {
  panelRaised: string; input: string; text: string; muted: string;
  border: string; borderStrong: string; accent: string; accentText: string;
};

type Props = {
  language: "no" | "en";
  settings: PartyModeSettings;
  reducedMotion: boolean;
  captureStatus: "off" | "starting" | "active" | "error";
  captureError: string;
  colors: Colors;
  onUpdate: (patch: Partial<PartyModeSettings>) => void;
  onStartAudio: () => void;
  onStopAudio: () => void;
};

export function PartyModePanel({ language, settings, reducedMotion, captureStatus, captureError, colors, onUpdate, onStartAudio, onStopAudio }: Props) {
  const no = language === "no";
  const ui = (norwegian: string, english: string) => no ? norwegian : english;
  const effectArea = settings.affectBackground && settings.affectChrome
    ? "whole"
    : settings.affectChrome ? "chrome" : "background";
  const button = { height: 30, padding: "0 9px", border: `1px solid ${colors.borderStrong}`, borderRadius: 4, background: colors.input, color: colors.text, cursor: "pointer", fontSize: 10 } as const;
  const slider = (key: "intensity" | "movement" | "glow" | "colorSpeed" | "sensitivity" | "bassSensitivity", label: string, value: number, min = 0, max = 1) => (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, color: colors.muted, fontSize: 10 }}>
      <span style={{ width: 108 }}>{label}</span>
      <input type="range" min={min} max={max} step="0.05" value={value} onChange={(event) => onUpdate({ [key]: Number(event.target.value) })} style={{ flex: 1 }} />
      <span style={{ width: 32, textAlign: "right" }}>{value.toFixed(key.includes("Sensitivity") || key === "sensitivity" ? 2 : 1)}</span>
    </label>
  );

  return (
    <div style={{ marginTop: 16, marginBottom: 12, padding: 12, border: `1px solid ${colors.borderStrong}`, borderRadius: 7, background: colors.panelRaised }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ color: colors.text, fontSize: 11, fontWeight: 800 }}>Party / Rave Mode</div>
          <div style={{ color: colors.muted, fontSize: 9.5, lineHeight: "15px", marginTop: 3 }}>
            {ui("Visuelle effekter med valgfri, lokal analyse av systemlyd. Ingen lyd tas opp, lagres eller lastes opp.", "Visual effects with optional local system-audio analysis. Audio is never recorded, stored, or uploaded.")}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: settings.enabled ? colors.accent : colors.muted, fontSize: 10, fontWeight: 750, cursor: "pointer" }}>
          <input type="checkbox" checked={settings.enabled} onChange={(event) => onUpdate({ enabled: event.target.checked })} />
          {settings.enabled ? ui("På", "On") : ui("Av", "Off")}
        </label>
      </div>

      {settings.enabled && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              onUpdate({
                enabled: true,
                style: "chaos",
                reactToSystemAudio: true,
                sensitivity: 2.5,
                bassSensitivity: 3,
                intensity: 1,
                movement: 1,
                glow: 1,
                colorSpeed: 1,
                fps: 60,
                affectBackground: true,
                affectChrome: true,
              });
              onStartAudio();
            }}
            style={{ ...button, height: 40, border: "1px solid #ff28e7", background: "linear-gradient(110deg,#ff1744,#8b22ff,#00d9ff,#00ff7b)", color: "#fff", fontWeight: 900, letterSpacing: ".06em", textShadow: "0 1px 3px #000", boxShadow: "0 0 18px rgba(180,35,255,.55)" }}
          >
            🔥 {ui("FULL RAVE – MAKS ALT", "FULL RAVE – MAX EVERYTHING")}
          </button>
          {reducedMotion && <div style={{ padding: 8, border: `1px solid ${colors.border}`, borderRadius: 5, color: colors.muted, fontSize: 9.5 }}>{ui("Satt på pause fordi redusert bevegelse er aktivert.", "Paused because reduced motion is enabled.")}</div>}
          <label style={{ display: "grid", gridTemplateColumns: "minmax(115px, 1fr) minmax(150px, 1.5fr)", alignItems: "center", gap: 9, color: colors.muted, fontSize: 10 }}>
            {ui("Stil", "Style")}
            <select value={settings.style} onChange={(event) => onUpdate({ style: event.target.value as PartyStyle })} style={{ ...button, width: "100%" }}>
              <option value="rainbow">Rainbow Rave</option>
              <option value="disco">Disco</option>
              <option value="bass">Bass Bounce</option>
              <option value="neon">Neon Pulse</option>
              <option value="spectrum">Spectrum</option>
              <option value="chill">Chill</option>
              <option value="chaos">Chaos</option>
            </select>
          </label>
          {slider("intensity", ui("Intensitet", "Intensity"), settings.intensity)}
          {slider("glow", ui("Glødstyrke", "Glow strength"), settings.glow)}
          {slider("movement", ui("Bevegelsesmengde", "Movement amount"), settings.movement)}
          {slider("colorSpeed", ui("Fargehastighet", "Color speed"), settings.colorSpeed)}
          <label style={{ display: "grid", gridTemplateColumns: "minmax(115px, 1fr) minmax(150px, 1.5fr)", alignItems: "center", gap: 9, color: colors.muted, fontSize: 10 }}>
            {ui("Effektområde", "Effect area")}
            <select value={effectArea} onChange={(event) => {
              const area = event.target.value;
              onUpdate({ affectBackground: area !== "chrome", affectChrome: area !== "background" });
            }} style={{ ...button, width: "100%" }}>
              <option value="background">{ui("Kun bakgrunn", "Background only")}</option>
              <option value="chrome">{ui("Kanter og knapper", "Borders & buttons")}</option>
              <option value="whole">{ui("Hele grensesnittet", "Whole UI")}</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: colors.text, fontSize: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={settings.reactToSystemAudio} onChange={(event) => onUpdate({ reactToSystemAudio: event.target.checked })} />
            {ui("Reager på systemlyd", "React to system audio")}
          </label>
          {settings.reactToSystemAudio && (
            <>
              {slider("sensitivity", ui("Følsomhet", "Sensitivity"), settings.sensitivity, .25, 3)}
              {slider("bassSensitivity", ui("Bassfølsomhet", "Bass sensitivity"), settings.bassSensitivity, .25, 3)}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                {captureStatus === "active"
                  ? <button onClick={onStopAudio} style={button}>{ui("Stopp lydanalyse", "Stop audio analysis")}</button>
                  : <button onClick={onStartAudio} disabled={captureStatus === "starting"} style={button}>{captureStatus === "starting" ? ui("Starter…", "Starting…") : ui("Start lokal lydanalyse", "Start local audio analysis")}</button>}
                <span style={{ color: captureStatus === "active" ? "#57c76f" : colors.muted, fontSize: 9.5 }}>
                  {captureStatus === "active" ? ui("Aktiv – kun lokal analyse", "Active – local analysis only") : ui("Velg skjermen med PC-lyd når Windows spør.", "Choose the screen with PC audio when Windows asks.")}
                </span>
              </div>
            </>
          )}
          {captureError && <div style={{ color: "#ff8d86", fontSize: 9.5 }}>{captureError}</div>}
          <label style={{ display: "grid", gridTemplateColumns: "minmax(115px, 1fr) minmax(150px, 1.5fr)", alignItems: "center", gap: 9, color: colors.muted, fontSize: 10 }}>
            FPS
            <select value={settings.fps} onChange={(event) => onUpdate({ fps: Number(event.target.value) as 15 | 30 | 60 })} style={{ ...button, width: "100%" }}>
              <option value={15}>15 ({ui("lav belastning", "low load")})</option><option value={30}>30</option><option value={60}>60</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
