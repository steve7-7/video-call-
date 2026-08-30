"use client";

import { useState } from "react";
import { LogoIcon } from "@/components/icons";

export interface BroadcastTopic {
  title: string;
  description?: string;
}

export function BroadcastTopicModal({
  open,
  onCancel,
  onStart,
}: {
  open: boolean;
  onCancel: () => void;
  onStart: (topic: BroadcastTopic) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = () => {
    const trimmed = title.trim();
    if (trimmed.length < 3) {
      setError("Please give your broadcast a short title (3+ characters).");
      return;
    }
    onStart({ title: trimmed, description: description.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <LogoIcon size={44} />
          <div>
            <h2 className="text-lg font-bold text-[#050505]">Go Live</h2>
            <p className="text-sm text-[#65676B]">Tell viewers what you’re broadcasting</p>
          </div>
        </div>

        <label className="mb-1.5 block text-sm font-semibold text-[#050505]">
          Broadcast title <span className="text-[#F02849]">*</span>
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={80}
          placeholder="e.g. Q&amp;A with the team"
          className="w-full rounded-lg border border-[#CED0D4] px-3 py-2.5 text-[15px] text-[#050505] outline-none placeholder:text-[#B0B3B8] focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/30"
        />

        <label className="mt-4 mb-1.5 block text-sm font-semibold text-[#050505]">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="What will you be talking about?"
          className="w-full resize-y rounded-lg border border-[#CED0D4] px-3 py-2.5 text-[15px] text-[#050505] outline-none placeholder:text-[#B0B3B8] focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/30"
        />

        {error && <p className="mt-2 text-sm text-[#F02849]">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-[#CED0D4] py-2.5 font-semibold text-[#050505] transition hover:bg-[#F0F2F5]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="flex-1 rounded-full bg-[#F02849] py-2.5 font-semibold text-white transition hover:bg-[#D9263F]"
          >
            Start live broadcast
          </button>
        </div>
      </div>
    </div>
  );
}
