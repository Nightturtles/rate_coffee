"use client";

import { LocateFixed } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PRESETS, placeQuery, type Place } from "@/lib/discovery";

const KEY = "rc:place";

/** Chooses the point that "near you" means. Server pages read it from the URL; we remember it in localStorage. */
export function LocationPicker({ current, fromUrl }: { current: Place; fromUrl: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = (p: Place) => {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
    router.push(`${path}?${placeQuery(p)}`);
  };

  // First visit without a URL location: restore the remembered one.
  useEffect(() => {
    if (fromUrl) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Place;
      if (typeof p.lat === "number" && typeof p.lng === "number" && p.label) router.replace(`${path}?${placeQuery(p)}`);
    } catch {}
  }, [fromUrl, path, router]);

  const locate = () => {
    if (!navigator.geolocation) { setErr("Location is not available in this browser."); return; }
    setLocating(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); go({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "your location" }); },
      () => { setLocating(false); setErr("Could not read your location."); },
      { timeout: 10000, maximumAge: 300000 },
    );
  };

  const tab = (active: boolean) => `-mb-px border-b pb-2 font-mono text-[11px] uppercase tracking-[0.12em] transition ${active ? "border-text text-text" : "border-transparent text-muted hover:text-text"}`;

  return (
    <div className="border-b border-border">
      <div className="flex items-end gap-x-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="label pb-2">Near</span>
        {PRESETS.map((p) => {
          const active = p.label === current.label;
          return (
            <button key={p.label} type="button" onClick={() => go(p)} className={tab(active)} aria-pressed={active}>
              {p.label}
            </button>
          );
        })}
        <button type="button" onClick={locate} disabled={locating} className={`${tab(current.label === "your location")} inline-flex items-center gap-1.5`}>
          <LocateFixed size={12} strokeWidth={1.6} /> {locating ? "Locating…" : "My location"}
        </button>
        {err && <span className="pb-2 text-xs text-muted">{err}</span>}
      </div>
    </div>
  );
}
