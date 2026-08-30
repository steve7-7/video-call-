"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireStream,
  listDevices,
  loadMediaSettings,
  saveMediaSettings,
  setTorch as applyTorch,
  type DeviceInfo,
} from "@/lib/media";
import type { MediaSettings } from "@/lib/types";

export interface MediaController {
  stream: MediaStream | null;
  /** Increments whenever tracks are replaced (device change). */
  streamEpoch: number;
  settings: MediaSettings;
  devices: DeviceInfo[];
  videoDevices: DeviceInfo[];
  audioDevices: DeviceInfo[];
  error: string | null;
  micLevel: number; // 0..1 smoothed
  start: () => Promise<void>;
  toggleVideo: () => void;
  toggleMic: () => void;
  setVideoDevice: (deviceId: string) => Promise<void>;
  setAudioDevice: (deviceId: string) => Promise<void>;
  /** Flip between front and back camera (no-op on desktops). */
  flipCamera: () => Promise<void>;
  setFacingMode: (mode: "user" | "environment") => Promise<void>;
  /** Toggle the rear-camera flashlight when available. */
  toggleTorch: () => Promise<boolean>;
  /** Whether torch is actually supported on the current device/track. */
  torchSupported: boolean;
}

/**
 * Owns the local MediaStream. Toggling camera/mic flips track.enabled so the
 * stream object (and therefore the RTCPeerConnection senders) stays stable.
 * Changing a device re-acquires the stream and swaps the tracks in place.
 */
export function useMedia(): MediaController {
  const [settings, setSettings] = useState<MediaSettings>(() => loadMediaSettings());
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [streamEpoch, setStreamEpoch] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const applyTrackStates = useCallback((s: MediaStream, st: MediaSettings) => {
    s.getVideoTracks().forEach((t) => (t.enabled = st.videoOn));
    s.getAudioTracks().forEach((t) => (t.enabled = st.micOn));
  }, []);

  const updateTorchSupport = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !track.getCapabilities) {
      setTorchSupported(false);
      return;
    }
    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      torch?: boolean;
    };
    setTorchSupported(Boolean(caps.torch));
  }, []);

  const start = useCallback(async () => {
    try {
      const s = await acquireStream(settingsRef.current);
      applyTrackStates(s, settingsRef.current);
      streamRef.current = s;
      setStream(s);
      setError(null);
      // Device labels are only available after permission is granted.
      const devs = await listDevices();
      setDevices(devs);
      updateTorchSupport();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Camera/microphone permission denied. Allow access in your browser and try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No camera or microphone found on this device.");
      } else {
        setError("Could not access your camera or microphone.");
      }
      console.error("getUserMedia failed", err);
    }
  }, [applyTrackStates]);

  useEffect(() => {
    void start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // We intentionally only start the stream on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: MediaSettings) => {
    setSettings(next);
    saveMediaSettings(next);
  }, []);

  const toggleVideo = useCallback(() => {
    const next = { ...settingsRef.current, videoOn: !settingsRef.current.videoOn };
    persist(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next.videoOn));
  }, [persist]);

  const toggleMic = useCallback(() => {
    const next = { ...settingsRef.current, micOn: !settingsRef.current.micOn };
    persist(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next.micOn));
  }, [persist]);

  const swapTracks = useCallback((oldStream: MediaStream, newStream: MediaStream) => {
    // Replace the tracks of the shared stream object so peers' senders
    // keep working without renegotiation.
    for (const track of [...oldStream.getVideoTracks(), ...oldStream.getAudioTracks()]) {
      oldStream.removeTrack(track);
    }
    for (const track of newStream.getTracks()) {
      oldStream.addTrack(track);
    }
    newStream.getTracks().forEach((t) => t.stop());
  }, []);

  const setVideoDevice = useCallback(
    async (deviceId: string) => {
      const next = { ...settingsRef.current, videoDeviceId: deviceId };
      persist(next);
      if (!streamRef.current) return;
      try {
        const s = await acquireStream(next);
        applyTrackStates(s, next);
        swapTracks(streamRef.current, s);
        setStreamEpoch((e) => e + 1);
      } catch {
        setError("Could not switch camera device.");
      }
    },
    [persist, swapTracks, applyTrackStates]
  );

  const setAudioDevice = useCallback(
    async (deviceId: string) => {
      const next = { ...settingsRef.current, audioDeviceId: deviceId };
      persist(next);
      if (!streamRef.current) return;
      try {
        const s = await acquireStream(next);
        applyTrackStates(s, next);
        swapTracks(streamRef.current, s);
        setStreamEpoch((e) => e + 1);
        updateTorchSupport();
      } catch {
        setError("Could not switch microphone device.");
      }
    },
    [persist, swapTracks, applyTrackStates, updateTorchSupport]
  );

  const setFacingMode = useCallback(
    async (mode: "user" | "environment") => {
      const next = {
        ...settingsRef.current,
        facingMode: mode,
        videoDeviceId: null, // facing mode implies letting the UA pick
        torch: false,
      };
      persist(next);
      if (!streamRef.current) return;
      try {
        const s = await acquireStream(next);
        applyTrackStates(s, next);
        swapTracks(streamRef.current, s);
        setStreamEpoch((e) => e + 1);
        updateTorchSupport();
      } catch {
        setError(`Could not switch to the ${mode === "user" ? "front" : "back"} camera.`);
      }
    },
    [persist, swapTracks, applyTrackStates, updateTorchSupport]
  );

  const flipCamera = useCallback(async () => {
    const nextMode =
      settingsRef.current.facingMode === "environment" ? "user" : "environment";
    await setFacingMode(nextMode);
  }, [setFacingMode]);

  const toggleTorch = useCallback(async () => {
    const next = { ...settingsRef.current, torch: !settingsRef.current.torch };
    const ok = await applyTorch(streamRef.current, next.torch);
    if (ok) {
      persist(next);
      return true;
    }
    setError("Torch is not available on this camera.");
    setTimeout(() => setError(null), 2500);
    return false;
  }, [persist]);

  /* Volume meter */
  useEffect(() => {
    if (!stream || !settings.micOn) {
      setMicLevel(0);
      return;
    }
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255;
      setMicLevel((prev) => prev * 0.6 + Math.min(1, avg * 2.2) * 0.4);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void audioCtx.close();
    };
  }, [stream, settings.micOn]);

  const videoDevices = devices.filter((d) => d.kind === "videoinput");
  const audioDevices = devices.filter((d) => d.kind === "audioinput");

  return {
    stream,
    streamEpoch,
    settings,
    devices,
    videoDevices,
    audioDevices,
    error,
    micLevel,
    start,
    toggleVideo,
    toggleMic,
    setVideoDevice,
    setAudioDevice,
    flipCamera,
    setFacingMode,
    toggleTorch,
    torchSupported,
  };
}
