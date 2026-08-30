"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { CloseIcon, HandRaiseIcon, ScreenShareIcon } from "@/components/icons";

export type ToastKind =
  | { kind: "join"; name: string }
  | { kind: "leave"; name: string }
  | { kind: "hand_raise"; name: string }
  | { kind: "hand_lower"; name: string }
  | { kind: "screen_share"; name: string }
  | { kind: "screen_stop"; name: string }
  | { kind: "recording"; name: string }
  | { kind: "virtual_bg"; name: string };

export interface ToastEntry {
  id: string;
  data: ToastKind;
  createdAt: number;
}

const TOAST_TTL = 4500;
const MAX_TOASTS = 5;

let toasts: ToastEntry[] = [];
let listeners = new Set<(t: ToastEntry[]) => void>();
let counter = 0;

export function addToast(data: ToastKind) {
  const entry: ToastEntry = { id: `t-${counter++}`, data, createdAt: Date.now() };
  toasts = [entry, ...toasts].slice(0, MAX_TOASTS);
  notify();
  setTimeout(() => removeToast(entry.id), TOAST_TTL);
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function notify() {
  listeners.forEach((fn) => fn([...toasts]));
}

function iconFor(kind: ToastKind): React.ReactNode {
  switch (kind.kind) {
    case "join":
      return <span className="h-2 w-2 rounded-full bg-[#31A24C] shrink-0" />;
    case "leave":
      return <span className="h-2 w-2 rounded-full bg-[#65676B] shrink-0" />;
    case "hand_raise":
      return <HandRaiseIcon size={16} className="text-[#F7B928] shrink-0" />;
    case "hand_lower":
      return <HandRaiseIcon size={16} className="text-[#65676B] shrink-0" />;
    case "screen_share":
      return <ScreenShareIcon size={16} className="text-[#0084FF] shrink-0" />;
    case "screen_stop":
      return <ScreenShareIcon size={16} className="text-[#65676B] shrink-0" />;
    case "recording":
      return <span className="shrink-0">🔴</span>;
    case "virtual_bg":
      return <span className="shrink-0">✨</span>;
  }
}

function textFor(kind: ToastKind): string {
  switch (kind.kind) {
    case "join":
      return `${kind.name} joined`;
    case "leave":
      return `${kind.name} left`;
    case "hand_raise":
      return `${kind.name} raised their hand`;
    case "hand_lower":
      return `${kind.name} lowered their hand`;
    case "screen_share":
      return `${kind.name} is sharing screen`;
    case "screen_stop":
      return `${kind.name} stopped sharing`;
    case "recording":
      return `${kind.name} is recording`;
    case "virtual_bg":
      return `${kind.name} enabled virtual background`;
  }
}

export function ToastContainer() {
  const [items, setItems] = useState(toasts);

  useEffect(() => {
    const unsub = subscribe((t) => setItems(t));
    return unsub;
  }, []);

  return (
    <div className="pointer-events-none fixed right-3 top-16 z-50 flex flex-col gap-2 safe-top sm:right-4">
      {items.map((entry) => (
        <div
          key={entry.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-[#1B1F24]/95 px-3.5 py-2.5 text-sm font-medium text-white shadow-2xl backdrop-blur-md animate-fade-in"
        >
          {iconFor(entry.data)}
          <span>{textFor(entry.data)}</span>
        </div>
      ))}
    </div>
  );
}

function subscribe(fn: (t: ToastEntry[]) => void): () => void {
  listeners.add(fn);
  fn([...toasts]);
  return () => {
    listeners.delete(fn);
  };
}
