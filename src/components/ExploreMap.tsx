"use client";

import { Map as MLMap, Marker, NavigationControl, setWorkerUrl, type LngLatBounds } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { distanceM, miles, MI, type DiscoverCafe, type DiscoverRoaster, type Place } from "@/lib/discovery";
import { PROCESS_FOCUS_LABEL, ROAST_LABEL } from "@/lib/labels";
import { btn, btnSmall } from "@/lib/ui";
import { Chip } from "./ui/Chip";
import { ScoreBadge, scoreTone } from "./ui/ScoreBadge";

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

type Layer = "cafes" | "roasters";
type Filters = { layer: Layer; lightOnly: boolean; ownedOnly: boolean; pourover: boolean; allCafes: boolean };
/** What we last asked the database for: a circle. */
type Query = { lat: number; lng: number; radiusM: number; label: string };
/** What the map currently shows. */
type View = { lat: number; lng: number; bounds: LngLatBounds; radiusM: number };

const INITIAL_RADIUS = 25 * MI;
const MIN_RADIUS = 3 * MI;
const MAX_RADIUS = 60 * MI;
const toneColor: Record<string, string> = { hi: "var(--score-hi)", mid: "var(--score-mid)", lo: "var(--score-lo)" };

function inView(v: View | null, p: { lat: number; lng: number }): boolean {
  return !v || v.bounds.contains([p.lng, p.lat]);
}

/** Pixel offsets that fan out markers sharing one coordinate so none hides another. */
function spreadOffsets(items: { id: string; lat: number; lng: number }[]): globalThis.Map<string, [number, number]> {
  const groups = new globalThis.Map<string, string[]>();
  for (const it of items) {
    const k = `${it.lat.toFixed(5)},${it.lng.toFixed(5)}`;
    groups.set(k, [...(groups.get(k) ?? []), it.id]);
  }
  const out = new globalThis.Map<string, [number, number]>();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const r = 7 + ids.length * 1.5;
    ids.forEach((id, i) => {
      const a = (2 * Math.PI * i) / ids.length - Math.PI / 2;
      out.set(id, [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))]);
    });
  }
  return out;
}

export function ExploreMap({ initial }: { initial: Place }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [query, setQuery] = useState<Query>({ lat: initial.lat, lng: initial.lng, radiusM: INITIAL_RADIUS, label: initial.label });
  const [view, setView] = useState<View | null>(null);
  const [cafes, setCafes] = useState<DiscoverCafe[]>([]);
  const [roasters, setRoasters] = useState<DiscoverRoaster[]>([]);
  const [filters, setFilters] = useState<Filters>({ layer: "cafes", lightOnly: false, ownedOnly: false, pourover: false, allCafes: false });
  const [selected, setSelected] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const dataKey = `${query.lat},${query.lng},${query.radiusM},${filters.allCafes}`;
  const loading = loadedKey !== dataKey;

  // The viewport pokes outside the circle we fetched, and a re-query would actually help
  // (we're not already at the radius cap with the same center): offer "Search this area".
  const drift = view ? distanceM(view, query) : 0;
  const uncovered = !!view && drift + view.radiusM > query.radiusM * 1.02;
  const stale = uncovered && (query.radiusM < MAX_RADIUS || drift > query.radiusM * 0.2);

  // Map boot
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // Bundlers can't resolve MapLibre's inline worker reliably; serve it as a static file (see npm run map:worker).
    setWorkerUrl("/maplibre-worker.mjs");
    const map = new MLMap({ container: container.current, style: dark ? STYLE_DARK : STYLE_LIGHT, center: [initial.lng, initial.lat], zoom: 11, attributionControl: { compact: true } });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const sync = () => {
      const c = map.getCenter(), b = map.getBounds(), ne = b.getNorthEast();
      setView({ lat: c.lat, lng: c.lng, bounds: b, radiusM: distanceM({ lat: c.lat, lng: c.lng }, { lat: ne.lat, lng: ne.lng }) });
    };
    map.on("load", sync);
    map.on("moveend", sync);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [initial.lat, initial.lng]);

  // Data
  useEffect(() => {
    let cancelled = false;
    const db = getSupabaseBrowserClient();
    Promise.all([
      db.rpc("discover_cafes", { lat: query.lat, lng: query.lng, radius_m: query.radiusM, lim: 400, with_signal: !filters.allCafes }),
      db.rpc("discover_roasters", { lat: query.lat, lng: query.lng, radius_m: query.radiusM, lim: 150 }),
    ]).then(([c, r]) => {
      if (cancelled) return;
      setCafes((c.data ?? []) as DiscoverCafe[]);
      setRoasters((r.data ?? []) as DiscoverRoaster[]);
      setLoadedKey(dataKey);
    });
    return () => { cancelled = true; };
  }, [query, filters.allCafes, dataKey]);

  // Distances are from where the map is now, not from the last query center.
  const from = view ?? query;
  const visibleCafes = useMemo(
    () => cafes.filter((c) => inView(view, c) && (!filters.ownedOnly || c.own_roaster_slug) && (!filters.pourover || c.has_pourover)),
    [cafes, filters, view],
  );
  const visibleRoasters = useMemo(
    () => roasters.filter((r) => inView(view, r) && (!filters.lightOnly || (r.roast_level ?? "").includes("light"))),
    [roasters, filters.lightOnly, view],
  );

  // Markers. City-only roasters get a list entry but no pin: a city centroid is not a place you can visit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    const items = filters.layer === "cafes"
      ? visibleCafes.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, score: c.specialty_score, name: c.name }))
      : visibleRoasters.filter((r) => r.pin_kind === "cafe").map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, score: r.specialty_score, name: r.name }));
    const offsets = spreadOffsets(items);
    for (const it of items) {
      const el = document.createElement("button");
      el.type = "button";
      el.title = it.name;
      el.setAttribute("aria-label", it.name);
      const big = it.id === selected;
      el.style.cssText = `width:${big ? 18 : 12}px;height:${big ? 18 : 12}px;border-radius:999px;background:${toneColor[scoreTone(it.score)]};border:2px solid var(--bg);box-shadow:0 1px 3px rgba(0,0,0,.3);cursor:pointer;opacity:${it.score == null ? 0.55 : 1}`;
      el.addEventListener("click", () => {
        setSelected(it.id);
        document.getElementById(`item-${it.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      markersRef.current.push(new Marker({ element: el, offset: offsets.get(it.id) ?? [0, 0] }).setLngLat([it.lng, it.lat]).addTo(map));
    }
  }, [visibleCafes, visibleRoasters, filters.layer, selected]);

  const searchHere = () => {
    if (!view) return;
    const radiusM = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, view.radiusM * 1.25));
    setQuery({ lat: view.lat, lng: view.lng, radiusM, label: "map center" });
  };

  const toggle = (k: keyof Filters) => setFilters((f) => ({ ...f, [k]: !f[k] }));
  const count = filters.layer === "cafes" ? visibleCafes.length : visibleRoasters.length;
  const noun = filters.layer === "cafes" ? "cafe" : "roaster";

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_380px]">
      <div className="relative">
        <div ref={container} className="h-[52vh] w-full overflow-hidden rounded-[2px] border border-border md:h-[calc(100vh-8.5rem)]" />
        {stale && (
          <button type="button" onClick={searchHere} className={`${btn} absolute left-1/2 top-3 h-9 -translate-x-1/2 shadow-md`}>
            Search this area
          </button>
        )}
      </div>
      <aside className="flex min-h-0 flex-col">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btnSmall} aria-pressed={filters.layer === "cafes"} onClick={() => setFilters((f) => ({ ...f, layer: "cafes" }))}>Cafes</button>
          <button type="button" className={btnSmall} aria-pressed={filters.layer === "roasters"} onClick={() => setFilters((f) => ({ ...f, layer: "roasters" }))}>Roasters</button>
          {filters.layer === "cafes" ? (
            <>
              <button type="button" className={btnSmall} aria-pressed={filters.ownedOnly} onClick={() => toggle("ownedOnly")}>Roaster-owned</button>
              <button type="button" className={btnSmall} aria-pressed={filters.pourover} onClick={() => toggle("pourover")}>Pour over</button>
              <button type="button" className={btnSmall} aria-pressed={filters.allCafes} onClick={() => toggle("allCafes")}>Show unknowns</button>
            </>
          ) : (
            <button type="button" className={btnSmall} aria-pressed={filters.lightOnly} onClick={() => toggle("lightOnly")}>Light roasters</button>
          )}
        </div>
        <p className="label mt-4">
          {loading ? "Loading…" : `${count} ${noun}${count === 1 ? "" : "s"} in view${stale ? " · outside the loaded area" : ""}`}
        </p>
        <ul className="mt-2 max-h-[40vh] overflow-y-auto border-t border-border md:max-h-[calc(100vh-13.5rem)]">
          {!loading && count === 0 && (
            <li className="py-6 text-sm text-muted">
              Nothing here yet. Zoom out, or hit Search this area.
            </li>
          )}
          {filters.layer === "cafes"
            ? visibleCafes.map((c) => (
                <li key={c.id} id={`item-${c.id}`}>
                  <Link href={`/cafes/${c.slug}`} onMouseEnter={() => setSelected(c.id)} className={`flex gap-3 border-b border-border px-1 py-3 transition ${selected === c.id ? "bg-surface-2" : "hover:bg-surface-2/60"}`}>
                    <ScoreBadge score={c.specialty_score} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{c.own_roaster_name ? `${c.own_roaster_name}'s cafe` : c.roaster_names.join(", ") || "no roaster signal"} · {miles(distanceM(from, c))}</p>
                    </div>
                  </Link>
                </li>
              ))
            : visibleRoasters.map((r) => (
                <li key={r.id} id={`item-${r.id}`}>
                  <Link href={`/roasters/${r.slug}`} onMouseEnter={() => setSelected(r.id)} className={`flex gap-3 border-b border-border px-1 py-3 transition ${selected === r.id ? "bg-surface-2" : "hover:bg-surface-2/60"}`}>
                    <ScoreBadge score={r.specialty_score} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{r.city}{r.pin_kind === "cafe" ? ` · ${miles(distanceM(from, r))}` : " · no shop on the map"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.roast_level && <Chip>{ROAST_LABEL[r.roast_level]}</Chip>}
                        {r.process_focus && <Chip>{PROCESS_FOCUS_LABEL[r.process_focus]}</Chip>}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
        </ul>
      </aside>
    </div>
  );
}
