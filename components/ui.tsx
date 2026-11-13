import type { ReactNode } from "react";
import type { DataMode } from "@/lib/data";

/** Shown when league data could not be loaded. */
export function DataError({ message }: { message: string }) {
  return (
    <div className="border-l-2 border-accent bg-surface px-4 py-3">
      <h2 className="font-semibold">League data did not load</h2>
      <p className="mt-1 text-muted">{message}</p>
      <p className="mt-1 text-muted">
        Run <code className="text-foreground">npm run check-data</code> in the project folder to test the FACEIT
        connection.
      </p>
    </div>
  );
}

export function MockBanner({ mode }: { mode: DataMode }) {
  if (mode !== "mock") return null;
  return (
    <p className="mb-6 border-l-2 border-accent bg-surface px-4 py-2 text-sm">
      Sample data, not real NECC results. Put a real key in .env.local to load live data.
    </p>
  );
}

export function Loading({ label }: { label: string }) {
  return <p className="text-muted">Loading {label}...</p>;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">{title}</h1>
      {children ? <p className="mt-2 max-w-[68ch] text-muted">{children}</p> : null}
    </div>
  );
}

/** A signed differential: white when positive, grey when negative. */
export function Diff({ value }: { value: number }) {
  if (value > 0) return <span className="text-foreground">+{value}</span>;
  if (value < 0) return <span className="text-faint">{value}</span>;
  return <span className="text-faint">0</span>;
}

export function percent(wins: number, played: number): string {
  return played ? `${((wins / played) * 100).toFixed(1)}%` : "0.0%";
}

/** Marks whole matches a team has forfeited. */
export function ForfeitTag({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="rounded-xs border border-accent px-1.5 text-xs font-medium leading-5 text-accent"
      title={`${count} whole ${count === 1 ? "match" : "matches"} forfeited`}
    >
      {count} FF
    </span>
  );
}

export const th = "px-3 py-2 text-sm font-medium text-muted";
