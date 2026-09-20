type UndoToastProps = {
  message: string;
  undoLabel: string;
  dismissLabel: string;
  onUndo: () => void;
  onDismiss: () => void;
  colors: {
    panel: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
  };
};

export function UndoToast({
  message,
  undoLabel,
  dismissLabel,
  onUndo,
  onDismiss,
  colors,
}: UndoToastProps) {
  return (
    <div
      className="fyflate-undo-toast fyflate-detached-surface"
      role="status"
      style={{
        position: "fixed",
        zIndex: 60000,
        left: "50%",
        bottom: 18,
        width: 420,
        maxWidth: "calc(100vw - 28px)",
        padding: "10px 11px",
        display: "flex",
        alignItems: "center",
        gap: 9,
        transform: "translateX(-50%)",
        border: `1px solid ${colors.border}`,
        borderRadius: 7,
        background: colors.panel,
        color: colors.text,
        boxShadow: "0 14px 42px rgba(0,0,0,.48)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: "15px" }}>
        {message}
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          height: 29,
          padding: "0 10px",
          border: `1px solid ${colors.accent}`,
          borderRadius: 5,
          background: "transparent",
          color: colors.accent,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {undoLabel}
      </button>
      <button
        type="button"
        aria-label={dismissLabel}
        title={dismissLabel}
        onClick={onDismiss}
        style={{
          width: 27,
          height: 27,
          padding: 0,
          border: "none",
          background: "transparent",
          color: colors.muted,
          fontSize: 18,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
