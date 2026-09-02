import { avatarColor, initials } from "@/lib/media";

export function Avatar({
  name,
  size = 40,
  online,
  className = "",
  avatarUrl,
}: {
  name: string;
  size?: number;
  online?: boolean;
  className?: string;
  avatarUrl?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Profile"
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white select-none"
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white select-none"
          style={{ backgroundColor: avatarColor(name), fontSize: size * 0.36 }}
        >
          {initials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className="absolute right-0 bottom-0 block rounded-full border-2 border-white"
          style={{
            width: Math.max(10, size * 0.28),
            height: Math.max(10, size * 0.28),
            backgroundColor: online ? "#31A24C" : "#8A8D91",
          }}
        />
      )}
    </div>
  );
}
