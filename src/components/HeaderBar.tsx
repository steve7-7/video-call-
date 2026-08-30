"use client";

import { Avatar } from "@/components/Avatar";
import {
  ChatIcon,
  CloseIcon,
  CopyIcon,
  GearIcon,
  LogoIcon,
  UsersIcon,
} from "@/components/icons";

/**
 * Call/Live room header bar.
 *
 * Props:
 *  - title: primary line
 *  - subtitle: secondary line (timer, viewer count, etc.)
 *  - showLiveBadge: render a red "LIVE" pill
 *  - onCopy / copyLabel: copy-link button (hidden when omitted)
 *  - panel: current open panel
 *  - setPanel: toggle a panel
 *  - showPeople: show the people toggle
 *  - unreadChat: badge count for chat
 *  - onSettings: open settings
 *  - backHref: if set, show a back button
 *  - children: optional extra header actions
 */
export function HeaderBar({
  title,
  subtitle,
  showLiveBadge,
  onCopy,
  copied,
  copyLabel,
  panel,
  setPanel,
  showPeople = true,
  unreadChat = 0,
  onSettings,
  children,
}: {
  title: string;
  subtitle: string;
  showLiveBadge?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  copyLabel?: string;
  panel: "none" | "chat" | "people";
  setPanel: (p: "none" | "chat" | "people") => void;
  showPeople?: boolean;
  unreadChat?: number;
  onSettings: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-[#181B1F] px-3 safe-top sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="shrink-0 max-sm:hidden">
          <LogoIcon size={28} />
        </span>
        <span className="shrink-0 sm:hidden">
          <LogoIcon size={24} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold sm:text-[15px]">{title}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-[#B0B3B8] sm:gap-2 sm:text-xs">
            {showLiveBadge && (
              <span className="flex items-center gap-1 rounded-full bg-[#F02849]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#F02849] sm:px-2 sm:text-[11px]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F02849]" />
                LIVE
              </span>
            )}
            {!showLiveBadge && (
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#31A24C]" />
            )}
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Copy / Share */}
        {onCopy && (
          <button
            onClick={onCopy}
            className="flex items-center gap-2 rounded-full bg-[#3A3B3C] px-3 py-2 text-sm font-semibold transition hover:bg-[#4E4F50] sm:px-4"
            title={copyLabel ?? "Copy link"}
          >
            {copied ? (
              <>
                <span className="text-[#31A24C]">✓</span>
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <CopyIcon size={16} /> <span className="hidden sm:inline">{copyLabel ?? "Copy link"}</span>
              </>
            )}
          </button>
        )}

        {/* Chat */}
        <button
          onClick={() => setPanel(panel === "chat" ? "none" : "chat")}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full transition sm:h-10 sm:w-10 ${
            panel === "chat" ? "bg-[#0084FF] text-white" : "bg-[#3A3B3C] hover:bg-[#4E4F50]"
          }`}
          title="Chat"
        >
          <ChatIcon size={17} />
          {unreadChat > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F02849] px-1 text-[11px] font-bold">
              {unreadChat}
            </span>
          )}
        </button>

        {/* People (call mode only) */}
        {showPeople && (
          <button
            onClick={() => setPanel(panel === "people" ? "none" : "people")}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition sm:h-10 sm:w-10 ${
              panel === "people" ? "bg-[#0084FF] text-white" : "bg-[#3A3B3C] hover:bg-[#4E4F50]"
            }`}
            title="People"
          >
            <UsersIcon size={17} />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onSettings}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3A3B3C] transition hover:bg-[#4E4F50] sm:h-10 sm:w-10"
          title="Settings"
        >
          <GearIcon size={17} />
        </button>

        {/* Extra children (e.g. audience count) */}
        {children}
      </div>
    </header>
  );
}
