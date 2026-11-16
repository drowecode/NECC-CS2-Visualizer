"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/rankings", label: "Season rankings" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/national", label: "National rankings" },
  { href: "/stats", label: "Player stats" },
  { href: "/rules", label: "Rules" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-x-6">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              "border-b-2 pb-3 text-[15px] font-medium " +
              (active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
