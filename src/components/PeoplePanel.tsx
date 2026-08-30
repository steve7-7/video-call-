"use client";

import { Avatar } from "@/components/Avatar";
import type { Participant } from "@/lib/types";

export function PeoplePanel({
  participants,
  user,
}: {
  participants: Participant[];
  user: Participant;
}) {
  return (
    <div className="flex h-full flex-col bg-[#242526]">
      <div className="border-b border-[#3A3B3C] px-4 py-3 text-sm font-bold text-white">
        In this call ({participants.length})
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#3A3B3C]">
            <Avatar name={p.name} size={36} online />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {p.name} {p.id === user.id && <span className="text-[#B0B3B8]">(You)</span>}
              </p>
              <p className="text-xs text-[#31A24C]">Connected</p>
            </div>
          </div>
        ))}
        {participants.length <= 1 && (
          <p className="px-2 py-6 text-center text-sm text-[#B0B3B8]">
            Share the invite link to bring people in.
          </p>
        )}
      </div>
    </div>
  );
}
