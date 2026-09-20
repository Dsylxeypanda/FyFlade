import { useState, type CSSProperties } from "react";

type HelpTipProps = {
  label: string;
  text: string;
  colors: {
    panel: string;
    text: string;
    muted: string;
    border: string;
  };
};

export function HelpTip({ label, text, colors }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const buttonStyle: CSSProperties = {
    width: 19,
    height: 19,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${colors.border}`,
    borderRadius: "50%",
    background: "transparent",
    color: colors.muted,
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={text}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        style={buttonStyle}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 25,
            top: -7,
            width: 245,
            padding: "8px 9px",
            border: `1px solid ${colors.border}`,
            borderRadius: 5,
            background: colors.panel,
            color: colors.text,
            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
            fontSize: 10,
            fontWeight: 500,
            lineHeight: "15px",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
