"use client";
import Link from "next/link";
import { Globe2, Plus, UserRound, ChartNoAxesCombined } from "lucide-react";
import { worldMessages } from "@/lib/world/i18n";
import { brand } from "@/lib/world/brand";
export default function WorldHeader({
  active = "world",
  locale = "en",
  onAdd,
}: {
  active?: "world" | "me" | "patterns";
  locale?: string;
  onAdd?: () => void;
}) {
  const m = worldMessages(locale);
  return (
    <header className="world-header">
      <Link className="world-logo" href="/">
        <Globe2 size={26} />
        <span>{brand.wordmark}</span>
      </Link>
      <nav aria-label={brand.name}>
        <Link aria-current={active === "world" ? "page" : undefined} href="/">
          <Globe2 size={17} />
          {m.world}
        </Link>
        <Link aria-current={active === "me" ? "page" : undefined} href="/me">
          <UserRound size={17} />
          {m.me}
        </Link>
        <Link
          aria-current={active === "patterns" ? "page" : undefined}
          href="/patterns"
        >
          <ChartNoAxesCombined size={17} />
          {m.patterns}
        </Link>
      </nav>
      {onAdd ? (
        <button className="world-add" aria-label={m.add} onClick={onAdd}>
          <Plus size={18} />
          <span>{m.add}</span>
        </button>
      ) : (
        <Link className="world-add" aria-label={m.add} href="/?add=1">
          <Plus size={18} />
          <span>{m.add}</span>
        </Link>
      )}
    </header>
  );
}
