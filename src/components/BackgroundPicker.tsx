"use client";

import { BACKGROUNDS, VIDEO_FILTERS, type VideoFilter } from "@/lib/features";
import { CloseIcon } from "@/components/icons";

/** New feature: a popup that lets the user pick a video filter and background. */
export function BackgroundPicker({
  filter,
  background,
  onFilterChange,
  onBackgroundChange,
  onClose,
  onNoiseSuppressionChange,
  noiseSuppression,
}: {
  filter: VideoFilter;
  background: string;
  onFilterChange: (f: VideoFilter) => void;
  onBackgroundChange: (id: string) => void;
  onClose: () => void;
  noiseSuppression: boolean;
  onNoiseSuppressionChange: (v: boolean) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-sheet-up safe-bottom sm:rounded-2xl sm:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 mb-0 h-1.5 w-10 shrink-0 rounded-full bg-[#D8DADF] sm:hidden" />
        <div className="flex items-center justify-between border-b border-[#E4E6EB] px-5 py-3.5">
          <h2 className="text-[17px] font-bold text-[#050505]">Look &amp; Sound</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4E6EB] text-[#050505] transition hover:bg-[#D8DADF]"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Filters */}
          <div>
            <p className="mb-2 text-sm font-bold text-[#050505]">Filters</p>
            <div className="grid grid-cols-5 gap-2">
              {VIDEO_FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => onFilterChange(f.id)}
                    className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition ${
                      active
                        ? "border-[#0084FF] bg-[#E7F3FF]"
                        : "border-[#CED0D4] hover:border-[#8AB4F8] hover:bg-[#F0F2F5]"
                    }`}
                  >
                    <span className="text-2xl">{f.preview}</span>
                    <span className={`text-[10px] font-bold ${active ? "text-[#0084FF]" : "text-[#65676B]"}`}>
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Backgrounds */}
          <div>
            <p className="mb-2 text-sm font-bold text-[#050505]">Virtual background</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {BACKGROUNDS.map((b) => {
                const active = background === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => onBackgroundChange(b.id)}
                    className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition ${
                      active
                        ? "border-[#0084FF] bg-[#E7F3FF]"
                        : "border-[#CED0D4] hover:border-[#8AB4F8] hover:bg-[#F0F2F5]"
                    }`}
                  >
                    <span className="text-2xl">{b.emoji}</span>
                    <span className={`text-[10px] font-bold ${active ? "text-[#0084FF]" : "text-[#65676B]"}`}>
                      {b.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Noise suppression */}
          <div className="flex items-center justify-between rounded-xl bg-[#F0F2F5] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#050505]">Noise suppression</p>
              <p className="text-xs text-[#65676B]">
                Reduces keyboard, fan, and background chatter.
              </p>
            </div>
            <button
              onClick={() => onNoiseSuppressionChange(!noiseSuppression)}
              className={`relative h-6 w-11 rounded-full transition ${
                noiseSuppression ? "bg-[#0084FF]" : "bg-[#CED0D4]"
              }`}
              aria-label="Toggle noise suppression"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  noiseSuppression ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="border-t border-[#E4E6EB] px-5 py-3.5">
          <button
            onClick={onClose}
            className="w-full rounded-full bg-[#0084FF] py-2.5 font-semibold text-white transition hover:bg-[#0073E6]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
