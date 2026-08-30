import type { MediaSettings } from "@/lib/types";

const SETTINGS_KEY = "calls:media";

export const DEFAULT_SETTINGS: MediaSettings = {
  videoDeviceId: null,
  audioDeviceId: null,
  videoOn: true,
  micOn: true,
  facingMode: "user",
  torch: false,
};

export function loadMediaSettings(): MediaSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MediaSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveMediaSettings(settings: MediaSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: "videoinput" | "audioinput";
}

/** Lists camera + microphone devices (labels appear after a permission grant). */
export async function listDevices(): Promise<DeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput" || d.kind === "audioinput")
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || (d.kind === "videoinput" ? "Camera" : "Microphone"),
      kind: d.kind as "videoinput" | "audioinput",
    }));
}

/** Builds getUserMedia constraints from the current settings. */
export function buildConstraints(settings: MediaSettings): MediaStreamConstraints {
  // When a specific device is chosen, drop facingMode so that constraint wins.
  const video: MediaTrackConstraints | boolean = settings.videoOn
    ? {
        deviceId: settings.videoDeviceId
          ? { exact: settings.videoDeviceId }
          : { ideal: undefined },
        facingMode: settings.videoDeviceId
          ? undefined
          : { ideal: settings.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      }
    : false;
  return {
    video,
    audio: settings.micOn
      ? {
          deviceId: settings.audioDeviceId
            ? { exact: settings.audioDeviceId }
            : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false,
  };
}

/** Best-effort torch on/off using the Image Capture API + MediaStreamTrack. */
export async function setTorch(
  stream: MediaStream | null,
  on: boolean
): Promise<boolean> {
  if (!stream) return false;
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  // Native torch (Samsung etc.) — both browser APIs and the W3C spec are supported.
  const capabilities = (
    track.getCapabilities?.() ?? {}
  ) as MediaTrackCapabilities & { torch?: boolean };
  if (capabilities.torch) {
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet & { torch?: boolean }] });
      return true;
    } catch {
      // fall through
    }
  }
  // ImageCapture API fallback (used by some Chromium browsers).
  try {
    type ImageCaptureCtor = new (
      track: MediaStreamTrack
    ) => {
      applyConstraints: (c: { advanced: Array<{ torch?: boolean }> }) => Promise<void>;
    };
    const w = window as unknown as { ImageCapture?: ImageCaptureCtor };
    if (w.ImageCapture) {
      const ic = new w.ImageCapture(track);
      await ic.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    }
  } catch {
    // no torch available
  }
  return false;
}

export async function acquireStream(settings: MediaSettings): Promise<MediaStream> {
  const constraints = buildConstraints(settings);
  return navigator.mediaDevices.getUserMedia(constraints);
}

/** Returns a deterministic color for an avatar based on a name hash. */
const AVATAR_COLORS = [
  "#0084FF",
  "#00A783",
  "#F5533D",
  "#FA3E4E",
  "#7C4DFF",
  "#F7B928",
  "#2AB3C8",
  "#E1306C",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
