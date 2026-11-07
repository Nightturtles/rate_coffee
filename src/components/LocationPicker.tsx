"use client";

import { LocateFixed, MapPin } from "lucide-react";
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-sm text-muted"><MapPin size={14} /> Near</span>
      {PRESETS.map((p) => {
        const active = p.label === current.label;
        return (
          <button key={p.label} type="button" onClick={() => go(p)} className={`rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-text hover:bg-surface-2"}`} aria-pressed={active}>
            {p.label}
          </button>
        );
      })}
      <button type="button" onClick={locate} disabled={locating} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${current.label === "your location" ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface hover:bg-surface-2"}`}>
        <LocateFixed size={14} /> {locating ? "Locating…" : "My location"}
      </button>
      {err && <span className="text-xs text-muted">{err}</span>}
    </div>
  );
}
