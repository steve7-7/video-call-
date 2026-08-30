/**
 * Shared utility functions used across call and live pages.
 * Eliminates all duplicate helpers that were copy-pasted between projects.
 */

/* ── ID / code generators ─────────────────────────────────────────── */

export const makeRoomCode = (): string => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const rand = new Uint32Array(7);
  crypto.getRandomValues(rand);
  let code = "";
  for (let i = 0; i < rand.length; i++) code += alphabet[rand[i] % alphabet.length];
  return code;
};

let idCounter = 0;
export const uid = (): string => `m-${Date.now()}-${idCounter++}`;

/* ── Time formatting ──────────────────────────────────────────────── */

export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatViewerCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.floor(n / 1000)}K`;
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ── React hook: elapsed seconds ──────────────────────────────────── */

import { useEffect, useState } from "react";

export function useElapsed(): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return elapsed;
}

/* ── Copy to clipboard helper ─────────────────────────────────────── */

export async function copyToClipboard(
  text: string,
  onCopied: () => void,
  duration = 2000
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    onCopied();
    setTimeout(() => onCopied(), duration);
  } catch {
    // Clipboard unavailable
  }
}

/* ── Sound effects ────────────────────────────────────────────────── */

export function beep(
  freq: number,
  duration = 0.15,
  type: OscillatorType = "sine"
): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio not available
  }
}
