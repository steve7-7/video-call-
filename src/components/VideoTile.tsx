"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar } from "@/components/Avatar";
import {
  MicOffIcon,
  HandRaisedIcon,
  ScreenShareIcon,
  SignalBarsIcon,
  VolumeIcon,
  CloseIcon,
} from "@/components/icons";

export interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  avatarName?: string;
  muted?: boolean;
  mirrored?: boolean;
  micOn?: boolean;
  connecting?: boolean;
  size?: number;
  /** Show hand raised indicator */
  handRaised?: boolean;
  /** Show screen sharing indicator */
  isScreenSharing?: boolean;
  /** Show virtual background indicator */
  virtualBg?: boolean;
  /** Show recording indicator */
  isRecording?: boolean;
  /** 0..1 connection quality */
  quality?: number;
  /** Enable per-participant volume control */
  controllable?: boolean;
  /** Remote peer ID for volume control */
  peerId?: string;
  /** Callback when volume changes */
  onVolumeChange?: (peerId: string, volume: number, muted: boolean) => void;
}

export function VideoTile({
  stream,
  label,
  avatarName,
  muted = false,
  mirrored = false,
  micOn = true,
  connecting = false,
  size = 96,
  handRaised = false,
  isScreenSharing = false,
  virtualBg = false,
  isRecording = false,
  quality = 0,
  controllable = false,
  peerId,
  onVolumeChange,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [showVolume, setShowVolume] = useState(false);
  const [localVolume, setLocalVolume] = useState(100);
  const [localMuted, setLocalMuted] = useState(false);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  // Unlock audio autoplay on first pointer interaction
  useEffect(() => {
    const unlock = () => ref.current?.play().catch(() => {});
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Set up audio gain for per-participant volume control
  useEffect(() => {
    if (!controllable || !peerId || !stream) return;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = localMuted ? 0 : localVolume / 100;
    gainNodeRef.current = gainNode;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Detach the video element's audio (mute it since we're routing through AudioContext)
    if (ref.current) ref.current.muted = true;

    return () => {
      source.disconnect();
      gainNode.disconnect();
      audioCtx.close();
      if (ref.current) ref.current.muted = muted;
    };
  }, [controllable, peerId, stream]);

  // Update gain when volume changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = localMuted ? 0 : localVolume / 100;
    }
  }, [localVolume, localMuted]);

  const handleVolumeChange = useCallback((v: number) => {
    setLocalVolume(v);
    if (v > 0) setLocalMuted(false);
    onVolumeChange?.(peerId!, v, v === 0);
  }, [peerId, onVolumeChange]);

  const toggleMute = useCallback(() => {
    setLocalMuted((prev) => {
      const next = !prev;
      if (next) {
        setLocalVolume(100);
        onVolumeChange?.(peerId!, 0, true);
      } else {
        onVolumeChange?.(peerId!, localVolume, false);
      }
      return next;
    });
  }, [peerId, localVolume, onVolumeChange]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#1B1F24]">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={Boolean(muted || (controllable && peerId))}
        className={`absolute inset-0 h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""} ${virtualBg ? "blur-background" : ""}`}
      />

      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="animate-pulse">
            <Avatar name={avatarName ?? label} size={size} />
          </div>
          <p className="text-sm font-medium text-[#B0B3B8]">
            {connecting ? `Connecting to ${label}…` : `Setting up camera…`}
          </p>
        </div>
      )}
      {stream && connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white">
            Connecting…
          </p>
        </div>
      )}

      {/* Top badges */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5">
        {isRecording && (
          <span className="flex items-center gap-1 rounded-full bg-[#F02849]/90 px-2 py-0.5 text-[10px] font-bold text-white">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            REC
          </span>
        )}
        {isScreenSharing && (
          <span className="flex items-center gap-1 rounded-full bg-[#0084FF]/90 px-2 py-0.5 text-[10px] font-bold text-white">
            <ScreenShareIcon size={10} />
            Sharing
          </span>
        )}
        {handRaised && (
          <span className="flex items-center gap-1 rounded-full bg-[#F7B928]/90 px-2 py-0.5 text-[10px] font-bold text-[#1B1F24]">
            <HandRaisedIcon size={10} />
            Hand raised
          </span>
        )}
      </div>

      {/* Connection quality */}
      {stream && quality > 0 && (
        <div className="absolute top-3 right-3">
          <SignalBarsIcon quality={quality} size={16} />
        </div>
      )}

      {/* Name badge */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {label}
        </span>
        {!micOn && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F02849] text-white">
            <MicOffIcon size={12} />
          </span>
        )}
      </div>

      {/* Hand raised floating icon */}
      {handRaised && (
        <div className="absolute bottom-14 right-3 animate-bounce">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7B928] text-[#1B1F24] shadow-lg">
            <HandRaisedIcon size={20} />
          </div>
        </div>
      )}

      {/* Volume control overlay */}
      {controllable && peerId && (
        <>
          <button
            onClick={() => setShowVolume((v) => !v)}
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
            title="Volume"
          >
            <VolumeIcon size={16} muted={localMuted} />
          </button>
          {showVolume && (
            <div className="absolute bottom-12 right-3 flex flex-col items-center gap-1.5 rounded-xl bg-black/80 px-3 py-2.5 backdrop-blur-md animate-fade-in">
              <button
                onClick={toggleMute}
                className="flex h-6 w-6 items-center justify-center text-white hover:text-[#F02849]"
                title={localMuted ? "Unmute" : "Mute"}
              >
                <VolumeIcon size={14} muted={localMuted} />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={localMuted ? 0 : localVolume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="h-1.5 w-16 appearance-none rounded-full bg-[#4E4F50] accent-[#0084FF] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0084FF]"
              />
              <span className="text-[10px] text-[#B0B3B8]">{localMuted ? 0 : localVolume}%</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Picture-in-picture variant. */
export function PiPTile(props: Omit<VideoTileProps, "controllable" | "peerId" | "onVolumeChange">) {
  return (
    <div className="pointer-events-none absolute right-3 bottom-20 z-10 aspect-video w-28 safe-bottom-mb sm:right-4 sm:bottom-4 sm:w-64 md:w-80">
      <VideoTile {...props} />
    </div>
  );
}
