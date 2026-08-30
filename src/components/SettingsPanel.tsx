"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaController } from "@/hooks/useMedia";
import {
  CloseIcon,
  FlashlightIcon,
  FlipCameraIcon,
  MicIcon,
  VideoIcon,
} from "@/components/icons";

function LevelMeter({ level }: { level: number }) {
  const bars = 24;
  return (
    <div className="flex h-8 items-end gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const active = level >= threshold;
        const height = 20 + ((i + 1) / bars) * 80;
        return (
          <div
            key={i}
            className="w-[6px] rounded-sm transition-colors duration-75"
            style={{
              height: `${height}%`,
              backgroundColor: active ? "#0084FF" : "#E4E6EB",
            }}
          />
        );
      })}
    </div>
  );
}

export function SettingsPanel({
  media,
  onClose,
  title = "Call settings",
  showFacingAndTorch = false,
}: {
  media: MediaController;
  onClose: () => void;
  title?: string;
  /** Adds front/back camera + torch controls (useful for live/host mode). */
  showFacingAndTorch?: boolean;
}) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const {
    stream,
    settings,
    videoDevices,
    audioDevices,
    micLevel,
    error,
    setVideoDevice,
    setAudioDevice,
    setFacingMode,
    flipCamera,
    toggleTorch,
    torchSupported,
  } = media;
  const [torchOn, setTorchOn] = useState(settings.torch);

  useEffect(() => {
    if (previewRef.current && stream) {
      previewRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    setTorchOn(settings.torch);
  }, [settings.torch]);

  const handleTorch = async () => {
    const ok = await toggleTorch();
    if (ok) setTorchOn((v) => !v);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-sheet-up safe-bottom sm:rounded-2xl sm:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="mx-auto mt-2.5 mb-0 h-1.5 w-10 shrink-0 rounded-full bg-[#D8DADF] sm:hidden" />
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E6EB] px-5 py-3.5 sm:py-4">
          <h2 className="text-[17px] font-bold text-[#050505]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4E6EB] text-[#050505] transition hover:bg-[#D8DADF]"
            aria-label="Close settings"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-xl bg-[#FFEBEE] px-4 py-3 text-sm font-medium text-[#F02849]">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Camera preview */}
          <div>
            <div className="relative mb-3 overflow-hidden rounded-2xl bg-[#1B1F24]">
              <video
                ref={previewRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-cover"
              />
              {!settings.videoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1B1F24]">
                  <div className="flex flex-col items-center gap-2 text-[#B0B3B8]">
                    <VideoIcon size={34} />
                    <span className="text-sm font-medium">Camera is off</span>
                  </div>
                </div>
              )}
              {torchOn && (
                <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-[#F7B928] px-3 py-1 text-xs font-bold text-[#1B1F24]">
                  <FlashlightIcon size={12} /> Torch on
                </span>
              )}
              <span className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {settings.facingMode === "user" ? "Front camera" : "Back camera"} preview
              </span>
            </div>

            <label className="mb-1.5 block text-sm font-semibold text-[#050505]">Camera</label>
            <select
              value={settings.videoDeviceId ?? ""}
              onChange={(e) => void setVideoDevice(e.target.value)}
              className="w-full rounded-lg border border-[#CED0D4] bg-white px-3 py-2.5 text-sm text-[#050505] outline-none focus:border-[#0084FF]"
              disabled={videoDevices.length === 0}
            >
              {videoDevices.length === 0 && <option value="">Default camera</option>}
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            {videoDevices.length === 0 && (
              <p className="mt-1.5 text-xs text-[#65676B]">
                No camera detected on this device.
              </p>
            )}

            {showFacingAndTorch && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => void setFacingMode("user")}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${
                    settings.facingMode === "user"
                      ? "border-[#0084FF] bg-[#E7F3FF] text-[#0084FF]"
                      : "border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                  }`}
                >
                  <FlipCameraIcon size={18} />
                  Front
                </button>
                <button
                  onClick={() => void setFacingMode("environment")}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${
                    settings.facingMode === "environment"
                      ? "border-[#0084FF] bg-[#E7F3FF] text-[#0084FF]"
                      : "border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                  }`}
                >
                  <FlipCameraIcon size={18} className="rotate-180" />
                  Back
                </button>
                <button
                  onClick={handleTorch}
                  disabled={!torchSupported}
                  title={torchSupported ? "Toggle torch" : "Torch is not available on this camera"}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    torchOn
                      ? "border-[#F7B928] bg-[#FEF5DA] text-[#7A5800]"
                      : "border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                  }`}
                >
                  <FlashlightIcon size={18} />
                  {torchOn ? "Torch on" : "Torch"}
                </button>
              </div>
            )}

            {showFacingAndTorch && (
              <p className="mt-2 text-xs text-[#65676B]">
                On phones you can switch between the front and back cameras, and turn
                on the flashlight (torch) for low-light broadcasts.
              </p>
            )}
          </div>

          {/* Microphone */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#050505]">Microphone</label>
            <select
              value={settings.audioDeviceId ?? ""}
              onChange={(e) => void setAudioDevice(e.target.value)}
              className="w-full rounded-lg border border-[#CED0D4] bg-white px-3 py-2.5 text-sm text-[#050505] outline-none focus:border-[#0084FF]"
              disabled={audioDevices.length === 0}
            >
              {audioDevices.length === 0 && <option value="">Default microphone</option>}
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#F0F2F5] px-4 py-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  settings.micOn && micLevel > 0.02
                    ? "bg-[#0084FF] text-white"
                    : "bg-[#E4E6EB] text-[#65676B]"
                }`}
              >
                <MicIcon size={18} />
              </span>
              <div className="flex-1">
                <LevelMeter level={micLevel} />
              </div>
              <span className="text-xs font-medium text-[#65676B]">
                {settings.micOn ? "Live input" : "Muted"}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#65676B]">
              Speak to test your microphone. Toggle mute and camera from the call controls.
            </p>
          </div>
        </div>

        <div className="border-t border-[#E4E6EB] px-5 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-full bg-[#0084FF] py-2.5 font-semibold text-white transition hover:bg-[#0073E6]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
