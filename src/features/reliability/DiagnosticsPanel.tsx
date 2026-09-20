import { useState } from "react";

import type { DiagnosticResult, DiagnosticStatus } from "./reliability";

type DiagnosticsPanelProps = {
  language: "no" | "en";
  results: DiagnosticResult[];
  running: boolean;
  lastRunAt: number;
  colors: {
    panel: string;
    input: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentText: string;
  };
  onRun: () => void;
};

function statusColor(status: DiagnosticStatus) {
  if (status === "ok") return "#57c76f";
  if (status === "checking") return "#5ab4ff";
  if (status === "warning") return "#e4bd55";
  if (status === "error") return "#ff827a";
  return "#858a94";
}

export function DiagnosticsPanel({
  language,
  results,
  running,
  lastRunAt,
  colors,
  onRun,
}: DiagnosticsPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const tr = (no: string, en: string) => (language === "no" ? no : en);

  return (
    <div
      data-settings-result-id="system-check"
      style={{
        marginTop: 15,
        padding: 12,
        border: `1px solid ${colors.border}`,
        borderRadius: 7,
        background: colors.panel,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 12.5 }}>
            {tr("Systemkontroll", "System check")}
          </strong>
          <div style={{ marginTop: 3, color: colors.muted, fontSize: 9.5, lineHeight: "14px" }}>
            {tr(
              "Kontrollerer kontoer, emoter, lokal lagring og OBS uten å bruke ekstra YouTube-kvote.",
              "Checks accounts, emotes, local storage, and OBS without using extra YouTube quota."
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={onRun}
          style={{
            height: 32,
            padding: "0 12px",
            border: `1px solid ${colors.accent}`,
            borderRadius: 5,
            background: colors.accent,
            color: colors.accentText,
            fontFamily: "inherit",
            fontSize: 9.5,
            fontWeight: 800,
            cursor: running ? "default" : "pointer",
            opacity: running ? 0.62 : 1,
          }}
        >
          {running
            ? tr("Kontrollerer...", "Checking...")
            : tr("Kjør kontroll", "Run check")}
        </button>
      </div>

      {results.length > 0 && (
        <>
          <div
            style={{
              marginTop: 11,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 7,
            }}
          >
            {results.map((result) => (
              <div
                key={result.id}
                style={{
                  minHeight: 50,
                  padding: "8px 9px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 6,
                  background: colors.input,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: statusColor(result.status),
                      flexShrink: 0,
                    }}
                  />
                  <strong style={{ fontSize: 10.5 }}>{result.label}</strong>
                </div>
                <div style={{ marginTop: 4, color: colors.muted, fontSize: 9, lineHeight: "13px" }}>
                  {result.summary}
                </div>
                {showDetails && result.details && (
                  <div
                    style={{
                      marginTop: 5,
                      paddingTop: 5,
                      borderTop: `1px solid ${colors.border}`,
                      color: colors.muted,
                      fontSize: 8.5,
                      lineHeight: "12px",
                    }}
                  >
                    {result.details}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              style={{
                padding: 0,
                border: "none",
                background: "transparent",
                color: colors.accent,
                fontFamily: "inherit",
                fontSize: 9,
                fontWeight: 750,
                cursor: "pointer",
              }}
            >
              {showDetails
                ? tr("Skjul detaljer", "Hide details")
                : tr("Vis detaljer", "Show details")}
            </button>
            {lastRunAt > 0 && (
              <span style={{ color: colors.muted, fontSize: 8.5 }}>
                {tr("Sist kontrollert", "Last checked")} {new Date(lastRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
