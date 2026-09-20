import type { ConnectionHealthState } from "./reliability";

type Colors = {
  panel: string;
  panelRaised: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
};

type Metric = {
  label: string;
  value: string | number;
};

type Props = {
  platform: string;
  icon: string;
  accent: string;
  state: ConnectionHealthState;
  statusLabel: string;
  detail: string;
  metrics: Metric[];
  note: string;
  colors: Colors;
};

const stateColor = (state: ConnectionHealthState) => {
  if (state === "connected") return "#5bd477";
  if (state === "connecting" || state === "reconnecting") return "#e2bd58";
  if (state === "sign-in" || state === "unavailable") return "#ff7169";
  return "#9298a6";
};

export function PlatformApiStatusCard({
  platform,
  icon,
  accent,
  state,
  statusLabel,
  detail,
  metrics,
  note,
  colors,
}: Props) {
  return (
    <section
      style={{
        minWidth: 0,
        padding: 11,
        border: `1px solid ${colors.border}`,
        borderRadius: 7,
        background: colors.panel,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 25,
            height: 25,
            borderRadius: 5,
            display: "grid",
            placeItems: "center",
            background: accent,
            color: "white",
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: "block", color: colors.text, fontSize: 12 }}>{platform}</strong>
          <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2, color: stateColor(state), fontSize: 9.5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: stateColor(state) }} />
            {statusLabel}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 8, color: colors.muted, fontSize: 9.5, lineHeight: "14px" }}>
        {detail}
      </div>

      <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: `repeat(${Math.max(1, metrics.length)}, minmax(0, 1fr))`, gap: 5 }}>
        {metrics.map((metric) => (
          <div key={metric.label} style={{ minWidth: 0, padding: "6px 7px", borderRadius: 5, background: colors.panelRaised }}>
            <div style={{ color: colors.subtle, fontSize: 8 }}>{metric.label}</div>
            <div style={{ marginTop: 2, overflow: "hidden", color: colors.text, fontSize: 11, fontWeight: 800, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${colors.border}`, color: colors.subtle, fontSize: 8.5, lineHeight: "13px" }}>
        {note}
      </div>
    </section>
  );
}
