/** New feature: video filter presets applied via CSS. */

export type VideoFilter = "none" | "bw" | "sepia" | "cool" | "warm";

export const VIDEO_FILTERS: { id: VideoFilter; label: string; preview: string; cssFilter: string }[] = [
  { id: "none",   label: "None",   preview: "🚫", cssFilter: "none" },
  { id: "bw",     label: "B&W",    preview: "⚫", cssFilter: "grayscale(1)" },
  { id: "sepia",  label: "Sepia",  preview: "🟤", cssFilter: "sepia(0.8)" },
  { id: "cool",   label: "Cool",   preview: "❄️", cssFilter: "hue-rotate(180deg) saturate(0.9)" },
  { id: "warm",   label: "Warm",   preview: "🔥", cssFilter: "sepia(0.3) saturate(1.3) hue-rotate(-15deg)" },
];

export const BACKGROUNDS: { id: string; label: string; emoji: string; css: string }[] = [
  { id: "none",   label: "None",         emoji: "🚫", css: "" },
  { id: "blur",   label: "Blur",         emoji: "🌀", css: "blur(10px) brightness(0.95)" },
  { id: "beach",  label: "Beach",        emoji: "🏖️", css: "brightness(1.1) sepia(0.2) hue-rotate(-10deg)" },
  { id: "office", label: "Office",       emoji: "🏢", css: "contrast(1.05) brightness(0.95) saturate(0.85)" },
  { id: "nature", label: "Forest",       emoji: "🌲", css: "brightness(1.05) saturate(1.4) hue-rotate(15deg)" },
  { id: "sunset", label: "Sunset",       emoji: "🌅", css: "brightness(1.15) sepia(0.3) saturate(1.3) hue-rotate(-25deg)" },
];
