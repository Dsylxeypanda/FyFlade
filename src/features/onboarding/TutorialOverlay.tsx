import type { TutorialStep } from "./onboarding";

export type TutorialTargetRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type TutorialColors = {
  panel: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
};

type TutorialOverlayProps = {
  step: TutorialStep;
  stepIndex: number;
  stepCount: number;
  language: "no" | "en";
  targetRect: TutorialTargetRect | null;
  reducedMotion: boolean;
  colors: TutorialColors;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

export function TutorialOverlay({
  step,
  stepIndex,
  stepCount,
  language,
  targetRect,
  reducedMotion,
  colors,
  onBack,
  onNext,
  onSkip,
}: TutorialOverlayProps) {
  const no = language === "no";
  const spotlight = targetRect
    ? (() => {
        // Keep the focus frame tight to the actual target and clamp each
        // edge independently so it never spills outside the app viewport.
        const padding = 3;
        const left = Math.max(0, Math.min(window.innerWidth, targetRect.left - padding));
        const top = Math.max(0, Math.min(window.innerHeight, targetRect.top - padding));
        const right = Math.max(left, Math.min(window.innerWidth, targetRect.right + padding));
        const bottom = Math.max(top, Math.min(window.innerHeight, targetRect.bottom + padding));

        return {
          left,
          top,
          width: right - left,
          height: bottom - top,
        };
      })()
    : null;
  const cardWidth = Math.min(360, window.innerWidth - 24);
  const estimatedCardHeight = 190;
  let cardLeft = Math.max(12, (window.innerWidth - cardWidth) / 2);
  let cardTop = Math.max(12, (window.innerHeight - estimatedCardHeight) / 2);

  if (spotlight) {
    cardLeft = Math.min(
      Math.max(12, spotlight.left),
      Math.max(12, window.innerWidth - cardWidth - 12)
    );
    const fitsBelow =
      spotlight.top + spotlight.height + 18 + estimatedCardHeight < window.innerHeight;
    cardTop = fitsBelow
      ? spotlight.top + spotlight.height + 18
      : Math.max(12, spotlight.top - estimatedCardHeight - 18);
  }

  const buttonStyle = {
    height: 32,
    padding: "0 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: 5,
    background: colors.panel,
    color: colors.text,
    fontFamily: "inherit",
    fontSize: 11,
    cursor: "pointer",
  } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={no ? step.titleNo : step.titleEn}
      style={{ position: "fixed", inset: 0, zIndex: 48000, pointerEvents: "none" }}
    >
      {spotlight ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
            height: spotlight.height,
            border: `1px solid ${colors.accent}`,
            borderRadius: 5,
            boxShadow: "0 0 0 9999px rgba(3, 5, 9, .72), 0 0 0 2px rgba(255,255,255,.08)",
            transition: reducedMotion ? "none" : "all 180ms ease",
          }}
        />
      ) : (
        <div aria-hidden="true" style={{ position: "fixed", inset: 0, background: "rgba(3, 5, 9, .72)" }} />
      )}

      <div
        style={{
          position: "fixed",
          left: cardLeft,
          top: cardTop,
          width: cardWidth,
          maxHeight: "calc(100vh - 24px)",
          overflowY: "auto",
          boxSizing: "border-box",
          padding: 16,
          border: `1px solid ${colors.border}`,
          borderRadius: 9,
          background: colors.panel,
          color: colors.text,
          boxShadow: "0 18px 55px rgba(0,0,0,.58)",
          pointerEvents: "auto",
          transition: reducedMotion ? "none" : "left 180ms ease, top 180ms ease",
        }}
      >
        <div style={{ color: colors.accent, fontSize: 9.5, fontWeight: 850, letterSpacing: ".05em" }}>
          {no ? `STEG ${stepIndex + 1} AV ${stepCount}` : `STEP ${stepIndex + 1} OF ${stepCount}`}
        </div>
        <div style={{ marginTop: 6, fontSize: 17, fontWeight: 850 }}>
          {no ? step.titleNo : step.titleEn}
        </div>
        <div style={{ marginTop: 7, color: colors.muted, fontSize: 11.5, lineHeight: "18px" }}>
          {no ? step.bodyNo : step.bodyEn}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 15 }}>
          <button onClick={onSkip} style={{ ...buttonStyle, border: "none", color: colors.muted }}>
            {no ? "Hopp over" : "Skip"}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onBack} disabled={stepIndex === 0} style={{ ...buttonStyle, opacity: stepIndex === 0 ? 0.42 : 1 }}>
            {no ? "Tilbake" : "Back"}
          </button>
          <button
            onClick={onNext}
            style={{ ...buttonStyle, borderColor: colors.accent, background: colors.accent, color: colors.accentText, fontWeight: 800 }}
          >
            {stepIndex + 1 === stepCount ? (no ? "Ferdig" : "Done") : (no ? "Neste" : "Next")}
          </button>
        </div>
      </div>
    </div>
  );
}
