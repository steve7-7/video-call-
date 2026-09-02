"use client";

import { useEffect, useState, useRef } from "react";
import { LogoIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";

const NAME_KEY = "calls:name";
const USER_KEY = "calls:user";
const AVATAR_KEY = "calls:avatar";

export function getUser(): { id: string; name: string; avatarUrl?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; name: string; avatarUrl?: string };
    if (!parsed.id || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUser(name: string, avatarUrl?: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = { id, name: name.trim(), avatarUrl };
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(NAME_KEY, user.name);
  if (avatarUrl) {
    window.localStorage.setItem(AVATAR_KEY, avatarUrl);
  }
  return user;
}

export function getAvatarUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AVATAR_KEY);
    return raw || null;
  } catch {
    return null;
  }
}

export function NameModal({
  open,
  onDone,
}: {
  open: boolean;
  onDone: (user: { id: string; name: string; avatarUrl?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const existing = window.localStorage.getItem(NAME_KEY);
      if (existing) setName(existing);
      const existingAvatar = getAvatarUrl();
      if (existingAvatar) setAvatarUrl(existingAvatar as string);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (name.trim().length < 2) {
      setError("Please enter your name (at least 2 characters).");
      return;
    }
    onDone(saveUser(name, avatarUrl));
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
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

        {/* Avatar preview section */}
        <div className="mb-4 flex flex-col items-center gap-2">
          {avatarUrl ? (
            <div className="relative">
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-2 border-[#CED0D4]"
                style={{ width: 40, height: 40 }}
              />
              <button
                type="button"
                className="absolute top-2 right-2 text-xs text-[#0084FF]"
                onClick={() => setAvatarUrl(undefined)}
                title="Remove avatar"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <Avatar name={name} size={40} online />
              <p className="text-xs text-[#65676B]">Click to add photo</p>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              const reader = new FileReader();
              reader.onload = (e) => {
                const url = e.target?.result as string;
                setAvatarUrl(url);
                setUploading(false);
              };
              reader.readAsDataURL(file);
            }}
            className="hidden"
          />
          <button onClick={handleBrowseClick} className="w-full rounded-lg border border-[#CED0D4] px-3 py-2.5 text-[15px] text-[#050505] hover:bg-[#F0F2F5] transition cursor-pointer">
            {uploading ? "Uploading..." : "Add profile photo"}
          </button>
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