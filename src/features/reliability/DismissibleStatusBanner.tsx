import { useState } from "react";

type Props = {
  title: string;
  message: string;
  dismissLabel: string;
  neverShowLabel: string;
  onDismiss: (neverShowAgain: boolean) => void;
  color?: string;
};

export function DismissibleStatusBanner({
  title,
  message,
  dismissLabel,
  neverShowLabel,
  onDismiss,
  color = "#e2bd58",
}: Props) {
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  return (
    <div
      role="status"
      style={{
        padding: "9px 10px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: `1px solid ${color}66`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        background: `${color}12`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 10.5 }}>{title}</strong>
        <span style={{ display: "block", marginTop: 2, opacity: .78, fontSize: 9.5, lineHeight: "14px" }}>{message}</span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 5, opacity: .8, fontSize: 8.5, whiteSpace: "nowrap", cursor: "pointer" }}>
        <input type="checkbox" checked={neverShowAgain} onChange={(event) => setNeverShowAgain(event.target.checked)} />
        {neverShowLabel}
      </label>
      <button
        onClick={() => onDismiss(neverShowAgain)}
        style={{ padding: "5px 8px", border: `1px solid ${color}77`, borderRadius: 4, background: "transparent", color: "inherit", cursor: "pointer", fontFamily: "inherit", fontSize: 9 }}
      >
        {dismissLabel}
      </button>
    </div>
  );
}
