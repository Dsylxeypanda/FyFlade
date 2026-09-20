export type HighlightSoundId = "pling" | "bell" | "soft" | "custom";
export type HighlightPulseStrength = "weak" | "normal" | "strong";
export type HighlightPulseSpeed = "slow" | "normal" | "fast";
export type HighlightVisualStyle = "bar" | "fill" | "glow";

export type HighlightPreferences = {
  color: string;
  soundEnabled: boolean;
  soundId: HighlightSoundId;
  soundVolume: number;
  customSoundDataUrl: string;
  customSoundName: string;
  pulseEnabled: boolean;
  pulseStrength: HighlightPulseStrength;
  pulseSpeed: HighlightPulseSpeed;
  visualStyle: HighlightVisualStyle;
  groupName: string;
};

export const DEFAULT_HIGHLIGHT_PREFERENCES: HighlightPreferences = {
  color: "#A970FF",
  soundEnabled: false,
  soundId: "pling",
  soundVolume: 0.7,
  customSoundDataUrl: "",
  customSoundName: "",
  pulseEnabled: false,
  pulseStrength: "weak",
  pulseSpeed: "normal",
  visualStyle: "bar",
  groupName: "",
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
      value?.soundId === "bell" || value?.soundId === "soft" || value?.soundId === "custom"
        ? value.soundId
        : "pling",
    soundVolume:
      typeof value?.soundVolume === "number" && Number.isFinite(value.soundVolume)
        ? Math.max(0, Math.min(1, value.soundVolume))
        : DEFAULT_HIGHLIGHT_PREFERENCES.soundVolume,
    customSoundDataUrl:
      typeof value?.customSoundDataUrl === "string" &&
      value.customSoundDataUrl.startsWith("data:audio/") &&
      value.customSoundDataUrl.length <= 1_100_000
        ? value.customSoundDataUrl
        : "",
    customSoundName:
      typeof value?.customSoundName === "string"
        ? value.customSoundName.trim().slice(0, 80)
        : "",
    pulseEnabled: value?.pulseEnabled === true,
    pulseStrength:
      value?.pulseStrength === "normal" || value?.pulseStrength === "strong"
        ? value.pulseStrength
        : "weak",
    pulseSpeed:
      value?.pulseSpeed === "slow" || value?.pulseSpeed === "fast"
        ? value.pulseSpeed
        : "normal",
    visualStyle:
      value?.visualStyle === "fill" || value?.visualStyle === "glow"
        ? value.visualStyle
        : "bar",
    groupName:
      typeof value?.groupName === "string"
        ? value.groupName.trim().slice(0, 40)
        : "",
  };
}

export function playBuiltInHighlightSound(
  context: AudioContext,
  soundId: HighlightSoundId,
  volume = DEFAULT_HIGHLIGHT_PREFERENCES.soundVolume
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
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, 0.18 * Math.max(0, Math.min(1, volume))),
      start + 0.012
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}
