"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SendIcon } from "@/components/icons";
import type { ChatMessage, Participant } from "@/lib/types";

/* ────────────────────────── Messenger bubble ─────────────────────── */

export function ChatBubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
          mine ? "rounded-br-md bg-[#0084FF] text-white" : "rounded-bl-md bg-[#3A3B3C] text-white"
        }`}
      >
        {!mine && <p className="mb-0.5 text-xs font-semibold text-[#8AB4F8]">{msg.name}</p>}
        <p className="text-[14px] break-words">{msg.body}</p>
      </div>
    </div>
  );
}

/* ──────────── Call-style chat (Messenger bubbles) ────────────────── */

export function CallChatPanel({
  messages,
  user,
  onSend,
}: {
  messages: ChatMessage[];
  user: Participant;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col bg-[#242526]">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-[#B0B3B8]">
            No messages yet. Say hi! 👋
          </p>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} msg={m} mine={m.from === user.id} />
        ))}
      </div>
      <ChatInput onSend={submit} draft={draft} setDraft={setDraft} placeholder="Send a message" />
    </div>
  );
}

/* ──────── Live-style chat (avatar + emoji shortcuts) ─────────────── */

export function LiveChatPanel({
  messages,
  user,
  onSend,
  onReact,
  inputDisabled,
}: {
  messages: ChatMessage[];
  user: Participant;
  onSend: (body: string) => void;
  onReact?: (emoji: string) => void;
  inputDisabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col bg-[#242526]">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-[#B0B3B8]">
            {inputDisabled
              ? "Live chat will appear here."
              : "Say hi to the host! 👋"}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <Avatar name={m.name} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#8AB4F8]">
                {m.name}
                {m.from === user.id && <span className="ml-1 text-[#B0B3B8]">(You)</span>}
              </p>
              <p className="break-words text-sm text-white">{m.body}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Quick react bar */}
      {onReact && (
        <div className="border-t border-[#3A3B3C] px-2 pt-2 pb-0.5">
          <div className="flex items-center gap-1">
            {["❤️", "😂", "🔥", "👏", "🎉", "😮"].map((e) => (
              <button
                key={e}
                onClick={() => onReact(e)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-lg transition hover:bg-[#3A3B3C] active:scale-90"
                title="React"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      <ChatInput
        onSend={submit}
        draft={draft}
        setDraft={setDraft}
        placeholder={inputDisabled ? "Hosts can't send chat" : "Say something…"}
        disabled={inputDisabled}
      />
    </div>
  );
}

/* ─────────────────────── Shared input bar ────────────────────────── */

function ChatInput({
  onSend,
  draft,
  setDraft,
  placeholder,
  disabled,
}: {
  onSend: () => void;
  draft: string;
  setDraft: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-[#3A3B3C] p-3">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={500}
        className="flex-1 rounded-full bg-[#3A3B3C] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#8A8D91] disabled:opacity-50"
      />
      <button
        onClick={onSend}
        disabled={disabled}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0084FF] text-white transition hover:bg-[#0073E6] disabled:opacity-50"
        aria-label="Send message"
      >
        <SendIcon size={18} />
      </button>
    </div>
  );
}
