"use client";

import { useState } from "react";

/** Up to two letters to stand in for a missing logo. */
function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A team's FACEIT avatar, or its initials when it has none or the image fails to load. */
export function TeamLogo({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        style={{ ...box, fontSize: Math.round(size * 0.4) }}
        className="inline-flex shrink-0 items-center justify-center rounded-xs bg-surface font-display font-semibold text-muted"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // FACEIT avatars come from several CDN hosts, so this is a plain image rather than next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={box}
      className="shrink-0 rounded-xs bg-surface object-cover"
    />
  );
}
