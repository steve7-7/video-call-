"use client";

import { useEffect, useState } from "react";
import { LogoIcon } from "@/components/icons";

const NAME_KEY = "calls:name";
const USER_KEY = "calls:user";

export function getUser(): { id: string; name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; name: string };
    if (!parsed.id || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUser(name: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = { id, name: name.trim() };
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(NAME_KEY, user.name);
  return user;
}

export function NameModal({
  open,
  onDone,
}: {
  open: boolean;
  onDone: (user: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      const existing = window.localStorage.getItem(NAME_KEY);
      if (existing) setName(existing);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (name.trim().length < 2) {
      setError("Please enter your name (at least 2 characters).");
      return;
    }
    onDone(saveUser(name));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <LogoIcon size={44} />
          <div>
            <h2 className="text-lg font-bold text-[#050505]">Welcome to Calls</h2>
            <p className="text-sm text-[#65676B]">Video calling, Messenger style</p>
          </div>
        </div>
        <label className="mb-1 block text-sm font-semibold text-[#050505]">
          What should people call you?
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={30}
          placeholder="e.g. Alex Johnson"
          className="w-full rounded-lg border border-[#CED0D4] px-3 py-2.5 text-[15px] text-[#050505] outline-none placeholder:text-[#B0B3B8] focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/30"
        />
        {error && <p className="mt-2 text-sm text-[#F02849]">{error}</p>}
        <button
          onClick={submit}
          className="mt-4 w-full rounded-full bg-[#0084FF] py-2.5 font-semibold text-white transition hover:bg-[#0073E6] active:scale-[0.98]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
