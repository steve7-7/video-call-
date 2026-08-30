"use client";

import { useState, useCallback } from "react";
import type { MediaController } from "@/hooks/useMedia";
import {
  FlashlightIcon,
  FlipCameraIcon,
  GearIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
  HandRaiseIcon,
  HandRaisedIcon,
  ScreenShareIcon,
  ExpandIcon,
  ShrinkIcon,
  BlurIcon,
} from "@/components/icons";

export function ControlBar({
  media,
  mode,
  onEnd,
  onSettings,
  extraButtons,
  endLabel,
  /** Hand raise state & toggle */
  handRaised,
  onHandRaise,
  /** Screen share state & toggle */
  screenSharing,
  onScreenShare,
  /** Virtual background toggle */
  virtualBg,
  onVirtualBg,
  /** Fullscreen toggle */
  fullscreen,
  onFullscreen,
  /** Emoji reaction callback */
  onReact,
  /** Recording state */
  recording,
  onRecording,
}: {
  media: MediaController;
  mode: "call" | "live";
  onEnd: () => void;
  onSettings: () => void;
  extraButtons?: React.ReactNode;
  endLabel?: string;
  handRaised?: boolean;
  onHandRaise?: () => void;
  screenSharing?: boolean;
  onScreenShare?: () => void;
  virtualBg?: boolean;
  onVirtualBg?: () => void;
  fullscreen?: boolean;
  onFullscreen?: () => void;
  onReact?: (emoji: string) => void;
  recording?: boolean;
  onRecording?: () => void;
}) {
  const [torchOn, setTorchOn] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const EMOJIS = ["❤️", "😂", "🔥", "👏", "🎉", "😮", "😢", "👍"];

  const handleTorch = useCallback(async () => {
    if (!media.torchSupported) return;
    const ok = await media.toggleTorch();
    if (ok) setTorchOn((v) => !v);
  }, [media]);

  const isLive = mode === "live";
  const endLbl = endLabel ?? (isLive ? "End live" : undefined);
  const bgMic = media.settings.micOn
    ? "bg-[#3A3B3C] text-white hover:bg-[#4E4F50]"
    : "bg-[#F02849] text-white";
  const bgVid = media.settings.videoOn
    ? "bg-[#3A3B3C] text-white hover:bg-[#4E4F50]"
    : "bg-[#F02849] text-white";

  const btnBase = "flex h-11 w-11 items-center justify-center rounded-full transition";

  return (
    <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 safe-bottom-mb">
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-[#1B1F24] px-2.5 py-2 shadow-2xl ring-1 ring-white/10 sm:gap-2 sm:px-3 sm:py-3">
        {/* Mic */}
        <button
          onClick={media.toggleMic}
          className={`${btnBase} ${bgMic}`}
          title={media.settings.micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {media.settings.micOn ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
        </button>

        {/* Camera */}
        <button
          onClick={media.toggleVideo}
          className={`${btnBase} ${bgVid}`}
          title={media.settings.videoOn ? "Turn camera off" : "Turn camera on"}
        >
          {media.settings.videoOn ? <VideoIcon size={18} /> : <VideoOffIcon size={18} />}
        </button>

        {/* Flip camera (live only) */}
        {isLive && (
          <button
            onClick={() => void media.flipCamera()}
            className={`${btnBase} bg-[#3A3B3C] text-white hover:bg-[#4E4F50]`}
            title="Flip camera"
          >
            <FlipCameraIcon size={18} />
          </button>
        )}

        {/* Torch (live only) */}
        {isLive && media.torchSupported && (
          <button
            onClick={handleTorch}
            className={`${btnBase} ${
              torchOn ? "bg-[#F7B928] text-[#1B1F24]" : "bg-[#3A3B3C] text-white hover:bg-[#4E4F50]"
            }`}
            title={torchOn ? "Turn torch off" : "Turn torch on"}
          >
            <FlashlightIcon size={18} />
          </button>
        )}

        {/* Hand raise */}
        {onHandRaise !== undefined && (
          <button
            onClick={onHandRaise}
            className={`${btnBase} ${
              handRaised
                ? "bg-[#F7B928] text-[#1B1F24]"
                : "bg-[#3A3B3C] text-white hover:bg-[#4E4F50]"
            }`}
            title={handRaised ? "Lower hand" : "Raise hand"}
          >
            {handRaised ? <HandRaisedIcon size={18} /> : <HandRaiseIcon size={18} />}
          </button>
        )}

        {/* Screen share */}
        {onScreenShare !== undefined && (
          <button
            onClick={onScreenShare}
            className={`${btnBase} ${
              screenSharing
                ? "bg-[#0084FF] text-white"
                : "bg-[#3A3B3C] text-white hover:bg-[#4E4F50]"
            }`}
            title={screenSharing ? "Stop sharing" : "Share screen"}
          >
            <ScreenShareIcon size={18} />
          </button>
        )}

        {/* Virtual background */}
        {onVirtualBg !== undefined && (
          <button
            onClick={onVirtualBg}
            className={`${btnBase} ${
              virtualBg
                ? "bg-[#0084FF] text-white"
                : "bg-[#3A3B3C] text-white hover:bg-[#4E4F50]"
            }`}
            title={virtualBg ? "Disable virtual background" : "Virtual background"}
          >
            <BlurIcon size={18} />
          </button>
        )}

        {/* Fullscreen */}
        {onFullscreen !== undefined && (
          <button
            onClick={onFullscreen}
            className={`${btnBase} bg-[#3A3B3C] text-white hover:bg-[#4E4F50]`}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <ShrinkIcon size={18} /> : <ExpandIcon size={18} />}
          </button>
        )}

        {/* Emoji reactions */}
        {onReact !== undefined && (
          <>
            <div className="relative">
              <button
                onClick={() => setShowReactions((v) => !v)}
                className={`${btnBase} bg-[#3A3B3C] text-white hover:bg-[#4E4F50]`}
                title="React"
              >
                😊
              </button>
              {showReactions && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-1 rounded-full bg-[#1B1F24] px-2 py-1.5 shadow-xl animate-fade-in">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        onReact(e);
                        setShowReactions(false);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:scale-125 hover:bg-white/10 active:scale-95"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Recording */}
        {onRecording !== undefined && (
          <button
            onClick={onRecording}
            className={`${btnBase} ${
              recording
                ? "bg-[#F02849] text-white animate-pulse"
                : "bg-[#3A3B3C] text-white hover:bg-[#4E4F50]"
            }`}
            title={recording ? "Stop recording" : "Start recording"}
          >
            🔴
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onSettings}
          className={`${btnBase} bg-[#3A3B3C] text-white hover:bg-[#4E4F50]`}
          title="Settings"
        >
          <GearIcon size={18} />
        </button>

        {/* Extra buttons */}
        {extraButtons}

        {/* End / Leave */}
        <button
          onClick={onEnd}
          className={`ml-0.5 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition sm:ml-1 sm:px-5 ${
            isLive ? "bg-[#F02849] hover:bg-[#D9263F]" : "bg-[#F02849] hover:bg-[#D9263F]"
          }`}
          title={isLive ? "End broadcast" : "End call"}
        >
          {isLive ? (
            <>
              <span className="inline-block h-2 w-2 rounded-sm bg-white" />
              {endLbl}
            </>
          ) : (
            <PhoneOffIcon size={20} />
          )}
        </button>
      </div>
    </div>
  );
}
