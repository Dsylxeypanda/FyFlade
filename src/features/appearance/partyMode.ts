import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  intensity: 0.65,
  movement: 0.55,
  glow: 0.5,
  colorSpeed: 0.55,
  fps: 30,
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
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [captureStatus, setCaptureStatus] = useState<"off" | "starting" | "active" | "error">("off");
  const [captureError, setCaptureError] = useState("");
  const [levels, setLevels] = useState<PartyLevels>({ energy: 0.18, bass: 0.12, phase: 0 });

  const stopAudioCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setCaptureStatus("off");
  }, []);

  const startAudioCapture = useCallback(async () => {
    stopAudioCapture();
    setCaptureStatus("starting");
    setCaptureError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("No system audio was shared.");
      }
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio analysis is not supported on this PC.");
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      context.createMediaStreamSource(stream).connect(analyser);
      stream.getVideoTracks().forEach((track) => { track.enabled = false; });
      stream.getTracks().forEach((track) => track.addEventListener("ended", stopAudioCapture, { once: true }));
      streamRef.current = stream;
      audioContextRef.current = context;
      analyserRef.current = analyser;
      setCaptureStatus("active");
    } catch (error) {
      setCaptureStatus("error");
      setCaptureError(error instanceof Error ? error.message : "System audio could not be started.");
    }
  }, [stopAudioCapture]);

  useEffect(() => stopAudioCapture, [stopAudioCapture]);

  useEffect(() => {
    if (!settings.enabled || reducedMotion) {
      setLevels((current) => ({ ...current, energy: 0, bass: 0 }));
      return;
    }
    let frame = 0;
    let lastFrame = 0;
    const data = new Uint8Array(128);
    const tick = (now: number) => {
      const current = settingsRef.current;
      const interval = 1000 / current.fps;
      if (now - lastFrame >= interval) {
        lastFrame = now;
        let energy = 0.2;
        let bass = 0.12;
        const analyser = analyserRef.current;
        if (current.reactToSystemAudio && analyser) {
          analyser.getByteFrequencyData(data);
          energy = (data.reduce((sum, value) => sum + value, 0) / data.length / 255) * current.sensitivity;
          bass = (data.slice(0, 14).reduce((sum, value) => sum + value, 0) / 14 / 255) * current.bassSensitivity;
        }
        setLevels({ energy: clamp(energy, 0, 1), bass: clamp(bass, 0, 1), phase: now * 0.001 * current.colorSpeed });
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
    "--party-speed": `${Math.max(1.5, 12 - settings.colorSpeed * 10)}s`,
  } as CSSProperties;

  return { captureStatus, captureError, levels, visualStyle, startAudioCapture, stopAudioCapture };
}
