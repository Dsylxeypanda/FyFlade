import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./partyMode.css";

export type PartyStyle = "rainbow" | "bass" | "neon" | "spectrum" | "disco" | "chill" | "chaos";
export type PartyFps = 15 | 30 | 60;

export type PartyModeSettings = {
  enabled: boolean;
  reactToSystemAudio: boolean;
  style: PartyStyle;
  sensitivity: number;
  bassSensitivity: number;
  intensity: number;
  movement: number;
  glow: number;
  colorSpeed: number;
  fps: PartyFps;
  affectBackground: boolean;
  affectChrome: boolean;
};

export const PARTY_MODE_SETTINGS_KEY = "fyflade.appearance.partyMode.v1";

export const DEFAULT_PARTY_MODE_SETTINGS: PartyModeSettings = {
  enabled: false,
  reactToSystemAudio: false,
  style: "rainbow",
  sensitivity: 1,
  bassSensitivity: 1,
  intensity: 0.9,
  movement: 0.85,
  glow: 0.85,
  colorSpeed: 0.8,
  fps: 60,
  affectBackground: true,
  affectChrome: true,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizePartyModeSettings(value: Partial<PartyModeSettings> | null | undefined): PartyModeSettings {
  const styles: PartyStyle[] = ["rainbow", "bass", "neon", "spectrum", "disco", "chill", "chaos"];
  return {
    enabled: value?.enabled === true,
    reactToSystemAudio: value?.reactToSystemAudio === true,
    style: styles.includes(value?.style as PartyStyle) ? value!.style as PartyStyle : "rainbow",
    sensitivity: clamp(Number(value?.sensitivity) || 1, 0.25, 3),
    bassSensitivity: clamp(Number(value?.bassSensitivity) || 1, 0.25, 3),
    intensity: clamp(Number(value?.intensity) || 0.65, 0.1, 1),
    movement: clamp(Number(value?.movement) || 0.55, 0, 1),
    glow: clamp(Number(value?.glow) || 0.5, 0, 1),
    colorSpeed: clamp(Number(value?.colorSpeed) || 0.55, 0.05, 1),
    fps: value?.fps === 15 || value?.fps === 60 ? value.fps : 30,
    affectBackground: value?.affectBackground !== false,
    affectChrome: value?.affectChrome !== false,
  };
}

export function readPartyModeSettings() {
  try {
    const raw = localStorage.getItem(PARTY_MODE_SETTINGS_KEY);
    return normalizePartyModeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_PARTY_MODE_SETTINGS };
  }
}

export function writePartyModeSettings(settings: PartyModeSettings) {
  localStorage.setItem(PARTY_MODE_SETTINGS_KEY, JSON.stringify(normalizePartyModeSettings(settings)));
}

type PartyLevels = { energy: number; bass: number; phase: number };

export function usePartyMode(settings: PartyModeSettings, reducedMotion: boolean) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const nativeLevelsRef = useRef({ energy: 0, bass: 0 });
  const [captureStatus, setCaptureStatus] = useState<"off" | "starting" | "active" | "error">("off");
  const [captureError, setCaptureError] = useState("");
  const [levels, setLevels] = useState<PartyLevels>({ energy: 0.18, bass: 0.12, phase: 0 });

  const stopAudioCapture = useCallback(() => {
    nativeLevelsRef.current = { energy: 0, bass: 0 };
    void invoke("stop_party_audio_capture").catch(() => undefined);
    setCaptureStatus("off");
  }, []);

  const startAudioCapture = useCallback(async () => {
    setCaptureStatus("starting");
    setCaptureError("");
    try {
      await invoke("start_party_audio_capture");
      setCaptureStatus("active");
    } catch (error) {
      setCaptureStatus("error");
      setCaptureError(error instanceof Error ? error.message : "System audio could not be started.");
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlistenLevels: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    void listen<{ energy: number; bass: number }>("fyflate://party-audio-levels", (event) => {
      nativeLevelsRef.current = event.payload;
      setCaptureStatus("active");
    }).then((unlisten) => { if (disposed) unlisten(); else unlistenLevels = unlisten; });
    void listen<string>("fyflate://party-audio-error", (event) => {
      setCaptureStatus("error");
      setCaptureError(event.payload || "Windows system audio stopped.");
    }).then((unlisten) => { if (disposed) unlisten(); else unlistenError = unlisten; });
    return () => {
      disposed = true;
      unlistenLevels?.();
      unlistenError?.();
    };
  }, []);

  useEffect(() => {
    if (settings.enabled && settings.reactToSystemAudio) {
      void startAudioCapture();
    } else if (!settings.enabled || !settings.reactToSystemAudio) {
      stopAudioCapture();
    }
  }, [settings.enabled, settings.reactToSystemAudio, startAudioCapture, stopAudioCapture]);

  useEffect(() => {
    if (!settings.enabled || reducedMotion) {
      setLevels((current) => ({ ...current, energy: 0, bass: 0 }));
      return;
    }
    let frame = 0;
    let lastFrame = 0;
    const tick = (now: number) => {
      const current = settingsRef.current;
      const interval = 1000 / current.fps;
      if (now - lastFrame >= interval) {
        lastFrame = now;
        let energy = 0.2;
        let bass = 0.12;
        if (current.reactToSystemAudio) {
          energy = nativeLevelsRef.current.energy * current.sensitivity;
          bass = nativeLevelsRef.current.bass * current.bassSensitivity;
        }
        const nextEnergy = clamp(energy, 0, 1);
        const nextBass = clamp(bass, 0, 1);
        setLevels({
          energy: nextEnergy,
          bass: nextBass,
          phase: now * 0.001 * (0.65 + current.colorSpeed * 3.4) + nextEnergy * 1.8 + nextBass * 2.4,
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settings.enabled, settings.fps, settings.reactToSystemAudio, reducedMotion]);

  const visualStyle = {
    "--party-energy": levels.energy,
    "--party-bass": levels.bass,
    "--party-phase": levels.phase,
    "--party-intensity": settings.intensity,
    "--party-movement": settings.movement,
    "--party-glow": settings.glow,
    "--party-spread": `${95 + settings.movement * 190}%`,
    "--party-speed": `${Math.max(0.55, 7 - settings.colorSpeed * 6.2)}s`,
    "--party-spin-speed": `${Math.max(0.8, 9 - settings.colorSpeed * 7.4)}s`,
    "--party-overlay-opacity": settings.intensity * (0.28 + levels.energy * 0.68),
    "--party-beat-scale": 1 + levels.bass * settings.movement * 0.14,
    "--party-beat-rotate": `${(levels.energy - 0.5) * settings.movement * 4}deg`,
    "--party-hue": `${(levels.phase * 92) % 360}deg`,
    "--party-phase-turn": `${levels.phase % 1}turn`,
    "--party-bass-radius": `${24 + levels.bass * 44}%`,
    "--party-saturation": 1.45 + levels.energy * 2.8,
    "--party-contrast": 1.05 + levels.bass * 0.8,
    "--party-glow-px": `${5 + settings.glow * 25 + levels.energy * 32}px`,
    "--party-inner-glow-px": `${2 + settings.glow * 10 + levels.energy * 12}px`,
    "--party-control-scale": 1 + levels.bass * settings.movement * 0.035,
    "--party-flash-opacity": settings.intensity * settings.glow * (0.08 + levels.bass * 0.72),
  } as CSSProperties;

  return { captureStatus, captureError, levels, visualStyle, startAudioCapture, stopAudioCapture };
}
