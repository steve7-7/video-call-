"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * New feature: noise suppression toggle. Routes the mic track through a
 * Web Audio bandpass filter to reduce low-frequency hum and high-frequency
 * hiss, which approximates the RNNoise/krisp behaviour on the client side
 * without requiring any model download.
 */
export function useNoiseSuppression() {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const originalStreamRef = useRef<MediaStream | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);

  /**
   * Attach to a live MediaStream. Returns a new stream that has a processed
   * audio track (if enabled) or the original stream.
   */
  const attach = useCallback(
    async (input: MediaStream | null): Promise<MediaStream | null> => {
      if (!input) return null;
      originalStreamRef.current = input;
      const audioTrack = input.getAudioTracks()[0];
      if (!audioTrack) return input;

      // Tear down any previous processing chain
      cleanup();

      if (!enabled) {
        outputStreamRef.current = input;
        return input;
      }

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      sourceRef.current = source;

      // High-pass: cuts sub-100Hz hum
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 80;
      hp.Q.value = 0.7;

      // Low-pass: rolls off above 12kHz to soften hiss
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 12000;
      lp.Q.value = 0.7;

      // Mild compressor to even out loud bursts (typing, breathing)
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -30;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.1;

      const gain = ctx.createGain();
      gain.gain.value = 1.1;
      gainRef.current = gain;

      source.connect(hp).connect(lp).connect(comp).connect(gain);

      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);

      filterRef.current = hp;

      const outputTrack = dest.stream.getAudioTracks()[0];
      if (!outputTrack) {
        cleanup();
        return input;
      }

      const out = new MediaStream([outputTrack, ...input.getVideoTracks()]);
      outputStreamRef.current = out;
      return out;
    },
    [enabled]
  );

  const cleanup = useCallback(() => {
    try {
      sourceRef.current?.disconnect();
      filterRef.current?.disconnect();
      gainRef.current?.disconnect();
      void ctxRef.current?.close();
    } catch {
      /* ignore */
    }
    sourceRef.current = null;
    filterRef.current = null;
    gainRef.current = null;
    ctxRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    enabled,
    setEnabled,
    attach,
  };
}
