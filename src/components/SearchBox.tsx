"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({ defaultValue = "", large = false }: { defaultValue?: string; large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative"
    >
      <Search size={large ? 18 : 14} strokeWidth={1.6} className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search roasters, cafes, coffees"
        aria-label="Search"
        className={`w-full border-0 border-b border-border bg-transparent pr-1 outline-none transition placeholder:text-muted focus:border-text ${large ? "h-12 pl-7 text-lg" : "h-9 pl-6 text-sm"}`}
      />
    </form>
  );
}
