"use client";

/**
 * New feature: scheduled calls. Persists a list of future call reminders in
 * localStorage and triggers a browser notification + vibration when due.
 * No existing code is touched — this is a self-contained module.
 */

import { useCallback, useEffect, useState } from "react";

export interface ScheduledCall {
  id: string;
  roomId: string;
  type: "call" | "live";
  title: string;
  when: number; // epoch ms
  createdAt: number;
  notified: boolean;
}

const KEY = "calls:scheduled";

function load(): ScheduledCall[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(list: ScheduledCall[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useScheduledCalls() {
  const [items, setItems] = useState<ScheduledCall[]>([]);

  useEffect(() => {
    setItems(load());
    // Tick every 15s to fire reminders
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const next = load().map((s) => {
        if (!s.notified && s.when <= now) {
          changed = true;
          fireNotification(s);
          return { ...s, notified: true };
        }
        return s;
      });
      if (changed) {
        save(next);
        setItems(next);
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const add = useCallback((c: Omit<ScheduledCall, "id" | "createdAt" | "notified">) => {
    const entry: ScheduledCall = {
      ...c,
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      notified: false,
    };
    const next = [entry, ...load()];
    save(next);
    setItems(next);
    return entry;
  }, []);

  const remove = useCallback((id: string) => {
    const next = load().filter((s) => s.id !== id);
    save(next);
    setItems(next);
  }, []);

  return { items, add, remove };
}

function fireNotification(c: ScheduledCall) {
  if (typeof window === "undefined") return;
  // Vibration on mobile
  if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  // Web notification
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(`Time for "${c.title}"`, {
        body: `Your ${c.type === "live" ? "live broadcast" : "call"} starts now.`,
        tag: c.id,
      });
    } else if (Notification.permission !== "denied") {
      void Notification.requestPermission();
    }
  }
}
