export type HighlightSoundId =
  | "pling"
  | "bell"
  | "soft"
  | "chime"
  | "pop"
  | "digital"
  | "sparkle"
  | "bass"
  | "arcade"
  | "custom";
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
    soundId: ["pling", "bell", "soft", "chime", "pop", "digital", "sparkle", "bass", "arcade", "custom"].includes(value?.soundId || "")
      ? value!.soundId as HighlightSoundId
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
  const patterns: Record<Exclude<HighlightSoundId, "custom">, { notes: number[]; spacing: number; duration: number; type: OscillatorType }> = {
    pling: { notes: [660, 880], spacing: 0.075, duration: 0.18, type: "triangle" },
    bell: { notes: [784, 1047], spacing: 0.09, duration: 0.32, type: "triangle" },
    soft: { notes: [392, 523], spacing: 0.11, duration: 0.22, type: "sine" },
    chime: { notes: [523, 659, 784], spacing: 0.085, duration: 0.28, type: "sine" },
    pop: { notes: [330, 660], spacing: 0.045, duration: 0.11, type: "square" },
    digital: { notes: [880, 1175, 988], spacing: 0.055, duration: 0.13, type: "square" },
    sparkle: { notes: [1047, 1319, 1568], spacing: 0.065, duration: 0.2, type: "sine" },
    bass: { notes: [147, 196], spacing: 0.12, duration: 0.3, type: "sine" },
    arcade: { notes: [523, 784, 1047, 1319], spacing: 0.05, duration: 0.12, type: "square" },
  };
  const pattern = patterns[soundId === "custom" ? "pling" : soundId];
  const now = context.currentTime;

  pattern.notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * pattern.spacing;
    const duration = pattern.duration;

    oscillator.type = pattern.type;
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
