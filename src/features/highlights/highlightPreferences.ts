export type HighlightSoundId = "pling" | "bell" | "soft";
export type HighlightPulseStrength = "weak" | "normal" | "strong";

export type HighlightPreferences = {
  color: string;
  soundEnabled: boolean;
  soundId: HighlightSoundId;
  pulseEnabled: boolean;
  pulseStrength: HighlightPulseStrength;
};

export const DEFAULT_HIGHLIGHT_PREFERENCES: HighlightPreferences = {
  color: "#A970FF",
  soundEnabled: false,
  soundId: "pling",
  pulseEnabled: false,
  pulseStrength: "weak",
};

export function normalizeHighlightPreferences(
  value: Partial<HighlightPreferences> | null | undefined
): HighlightPreferences {
  return {
    color:
      typeof value?.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color)
        ? value.color.toUpperCase()
        : DEFAULT_HIGHLIGHT_PREFERENCES.color,
    soundEnabled: value?.soundEnabled === true,
    soundId:
      value?.soundId === "bell" || value?.soundId === "soft"
        ? value.soundId
        : "pling",
    pulseEnabled: value?.pulseEnabled === true,
    pulseStrength:
      value?.pulseStrength === "normal" || value?.pulseStrength === "strong"
        ? value.pulseStrength
        : "weak",
  };
}

export function playBuiltInHighlightSound(
  context: AudioContext,
  soundId: HighlightSoundId
) {
  const notes =
    soundId === "bell"
      ? [784, 1047]
      : soundId === "soft"
        ? [392, 523]
        : [660, 880];
  const now = context.currentTime;

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * 0.075;
    const duration = soundId === "bell" ? 0.32 : 0.18;

    oscillator.type = soundId === "soft" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}

