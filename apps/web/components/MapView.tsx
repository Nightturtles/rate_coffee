"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import Link from "next/link";

const defaultCenter: [number, number] = [-98.5, 39.8];
const defaultZoom = 3.2;

type Pt = {
  id: string;
  name: string;
  kind: "cafe" | "roaster";
  lng: number;
  lat: number;
};

function buildGeojson(items: Pt[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.map((c) => ({
      type: "Feature" as const,
      properties: { kind: c.kind, name: c.name, id: c.id },
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    })),
  };
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const interactionsAttachedRef = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<Pt[]>([]);

  const loadMarkers = useCallback(async (lat: number, lng: number) => {
    if (!isSupabaseConfigured()) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    setErr(null);
    const [cafes, roasters] = await Promise.all([
      supabase.rpc("nearby_cafes", { lat, lng, radius_meters: 1_000_000 }),
      supabase.rpc("nearby_roasters", { lat, lng, radius_meters: 1_000_000 }),
    ]);
    if (cafes.error) {
      setErr(cafes.error.message);
      return;
    }
    if (roasters.error) {
      setErr(roasters.error.message);
      return;
    }
    const ca = (cafes.data ?? []) as {
      id: string;
      out_lat: number;
      out_lng: number;
      name: string;
    }[];
    const ro = (roasters.data ?? []) as {
      id: string;
      out_lat: number;
      out_lng: number;
      name: string;
    }[];
    const pts: Pt[] = [
      ...ca.map((c) => ({
        id: c.id,
        name: c.name,
        kind: "cafe" as const,
        lat: c.out_lat,
        lng: c.out_lng,
      })),
      ...ro.map((r) => ({
        id: r.id,
        name: r.name,
        kind: "roaster" as const,
        lat: r.out_lat,
        lng: r.out_lng,
      })),
    ];
    setList(pts.slice(0, 32));
    const m = mapRef.current;
    if (m) {
      const data = buildGeojson(pts);
      const src = m.getSource("points") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        m.addSource("points", { type: "geojson", data });
        m.addLayer({
          id: "pt-circles",
          type: "circle",
          source: "points",
          paint: {
            "circle-radius": 7,
            "circle-color": [
              "match",
              ["get", "kind"],
              "cafe",
              "#b45309",
              "#78350f",
            ],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fffbeb",
          },
        });
        if (!interactionsAttachedRef.current) {
          m.on("mouseenter", "pt-circles", () => {
            m.getCanvas().style.cursor = "pointer";
          });
          m.on("mouseleave", "pt-circles", () => {
            m.getCanvas().style.cursor = "";
          });
          m.on("click", "pt-circles", (event) => {
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== "Point") {
              return;
            }
            const props = feature.properties as
              | { id?: string; name?: string; kind?: "cafe" | "roaster" }
              | undefined;
            const id = props?.id;
            const name = props?.name;
            const kind = props?.kind;
            if (!id || !name || !kind) {
              return;
            }
            const wrapper = document.createElement("div");
            wrapper.className = "text-sm";
            const title = document.createElement("div");
            title.className = "font-medium";
            title.textContent = name;
            const meta = document.createElement("div");
            meta.className = "mt-1 text-xs";
            const link = document.createElement("a");
            link.href = kind === "cafe" ? `/cafe/?id=${id}` : `/roaster/?id=${id}`;
            link.textContent = `Open ${kind} profile`;
            link.style.textDecoration = "underline";
            link.style.color = "#78350f";
            meta.appendChild(link);
            wrapper.appendChild(title);
            wrapper.appendChild(meta);
            new maplibregl.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat((feature.geometry.coordinates as [number, number]).slice() as [number, number])
              .setDOMContent(wrapper)
              .addTo(m);
          });
          interactionsAttachedRef.current = true;
        }
        // Avoid symbol/text layer here because the inline raster style
        // does not provide a glyphs endpoint.
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !container.current) {
      return;
    }
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap · © CARTO",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "base" }],
      },
      center: defaultCenter,
      zoom: defaultZoom,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      const c = map.getCenter();
      void loadMarkers(c.lat, c.lng);
    });
    let t: ReturnType<typeof setTimeout> | null = null;
    map.on("moveend", () => {
      if (t) {
        clearTimeout(t);
      }
      t = setTimeout(() => {
        const c = map.getCenter();
        void loadMarkers(c.lat, c.lng);
        t = null;
      }, 500);
    });
    return () => {
      if (t) {
        clearTimeout(t);
      }
      map.remove();
      mapRef.current = null;
      interactionsAttachedRef.current = false;
    };
  }, [loadMarkers]);

  if (!isSupabaseConfigured()) {
    return (
      <p className="p-4 text-amber-800/80">
        Configure Supabase in <code className="text-xs">.env.local</code> to load the map.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-700">{err}</p>}
      <div
        ref={container}
        className="h-[min(70vh,520px)] w-full overflow-hidden rounded-lg border border-amber-900/20"
      />
      <p className="text-xs text-amber-800/70">
        Pan the map; pins refresh to ~1000 km of the view center.{" "}
        {ready ? "Loaded." : "Loading map…"}
      </p>
      {list.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {list.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <Link
                className="text-amber-900 underline"
                href={i.kind === "cafe" ? `/cafe/?id=${i.id}` : `/roaster/?id=${i.id}`}
              >
                {i.name} ({i.kind})
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
