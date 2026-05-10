"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import Link from "next/link";

const defaultCenter: [number, number] = [-98.5, 39.8];
const defaultZoom = 3.2;

/** Statute miles → meters */
const MILES_TO_METERS = 1609.344;
/** Initial view: ~25 mi radius around user when geolocation succeeds */
const INITIAL_VIEW_RADIUS_MILES = 25;
/** Keep RPC radius bounded so each refresh is consistently fast. */
const MIN_QUERY_RADIUS_METERS = 8_000;
const MAX_QUERY_RADIUS_METERS = 80_000;

/**
 * Axis-aligned bounds containing a circle of radius (meters) around (lat, lng).
 * Good enough for fitting the map to a “~N mile radius” view.
 */
function boundsForRadiusMeters(
  lat: number,
  lng: number,
  radiusM: number
): maplibregl.LngLatBoundsLike {
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.max(Math.cos(latRad), 1e-6);
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * cosLat);
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat + dLat],
  ];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function queryRadiusMetersFromViewport(map: Map): number {
  const center = map.getCenter();
  const ne = map.getBounds().getNorthEast();
  // Slightly larger than half-diagonal, capped for predictable RPC latency.
  const raw = center.distanceTo(ne) * 1.2;
  return Math.round(clamp(raw, MIN_QUERY_RADIUS_METERS, MAX_QUERY_RADIUS_METERS));
}

function geolocationErrorMessage(err: unknown): string {
  const code = (err as GeolocationPositionError | undefined)?.code;
  if (code === 1) {
    return "Location blocked — allow location for this site in the browser address bar or settings.";
  }
  if (code === 2) {
    return "Location unavailable (device may not have a fix yet). Try again in a few seconds.";
  }
  if (code === 3) {
    return "Couldn’t get precise location within 10 seconds — switching to approximate location.";
  }
  return (err as GeolocationPositionError | undefined)?.message ?? "Could not read your location.";
}

function getBrowserLatLng(
  options: PositionOptions
): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      reject,
      options
    );
  });
}

async function getIpApproxLatLng(): Promise<{ lat: number; lng: number; source: string } | null> {
  // Try multiple providers so one blocked endpoint does not break fallback.
  try {
    const r = await fetch("https://ipapi.co/json/");
    if (r.ok) {
      const j = (await r.json()) as { latitude?: number; longitude?: number };
      if (typeof j.latitude === "number" && typeof j.longitude === "number") {
        return { lat: j.latitude, lng: j.longitude, source: "ipapi.co" };
      }
    }
  } catch {
    // Continue to next provider.
  }
  try {
    const r = await fetch("https://ipwho.is/");
    if (r.ok) {
      const j = (await r.json()) as { success?: boolean; latitude?: number; longitude?: number };
      if (j.success !== false && typeof j.latitude === "number" && typeof j.longitude === "number") {
        return { lat: j.latitude, lng: j.longitude, source: "ipwho.is" };
      }
    }
  } catch {
    // No fallback available.
  }
  return null;
}

type Pt = {
  id: string;
  name: string;
  kind: "cafe" | "roaster";
  lng: number;
  lat: number;
};

type DiagEntry = {
  at: number;
  category: "geolocate" | "markers" | "permission";
  message: string;
};

type LocationStatus =
  | { kind: "none" }
  | { kind: "precise"; detail?: string }
  | { kind: "approximate"; detail: string };

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
  const [loadingMarkers, setLoadingMarkers] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({ kind: "none" });
  const [diag, setDiag] = useState<DiagEntry[]>([]);
  const markerReqSeqRef = useRef(0);
  const markerAbortRef = useRef<AbortController | null>(null);
  const geolocateStartRef = useRef<number | null>(null);
  const locatingRef = useRef(false);
  const locateReqSeqRef = useRef(0);

  const pushDiag = useCallback((entry: Omit<DiagEntry, "at">) => {
    setDiag((prev) => [{ at: Date.now(), ...entry }, ...prev].slice(0, 40));
  }, []);

  const loadMarkers = useCallback(async (lat: number, lng: number) => {
    if (!isSupabaseConfigured()) {
      return;
    }
    markerAbortRef.current?.abort();
    const controller = new AbortController();
    markerAbortRef.current = controller;
    const reqSeq = ++markerReqSeqRef.current;

    const supabase = getSupabaseBrowserClient();
    const map = mapRef.current;
    const radiusMeters = map ? queryRadiusMetersFromViewport(map) : MAX_QUERY_RADIUS_METERS;
    const startedAt = performance.now();
    setErr(null);
    setLoadingMarkers(true);
    pushDiag({
      category: "markers",
      message: `start lat=${lat.toFixed(4)} lng=${lng.toFixed(4)} r=${Math.round(radiusMeters)}m`,
    });
    try {
      const [cafes, roasters] = await Promise.all([
        supabase
          .rpc("nearby_cafes", { lat, lng, radius_meters: radiusMeters })
          .abortSignal(controller.signal),
        supabase
          .rpc("nearby_roasters", { lat, lng, radius_meters: radiusMeters })
          .abortSignal(controller.signal),
      ]);
      if (controller.signal.aborted || reqSeq !== markerReqSeqRef.current) {
        pushDiag({ category: "markers", message: "stale/aborted response ignored" });
        return;
      }
      if (cafes.error) {
        setErr(cafes.error.message);
        pushDiag({ category: "markers", message: `rpc error cafes: ${cafes.error.message}` });
        return;
      }
      if (roasters.error) {
        setErr(roasters.error.message);
        pushDiag({ category: "markers", message: `rpc error roasters: ${roasters.error.message}` });
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
      pushDiag({
        category: "markers",
        message: `ok ${pts.length} pins in ${Math.round(performance.now() - startedAt)}ms`,
      });
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
                "#606e33",
                "#5c6341",
              ],
              "circle-stroke-width": 1,
              "circle-stroke-color": "#f9f9f7",
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
              link.style.color = "#606e33";
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
    } catch (e) {
      if (controller.signal.aborted || reqSeq !== markerReqSeqRef.current) {
        pushDiag({ category: "markers", message: "request aborted" });
        return;
      }
      const message = e instanceof Error ? e.message : "Failed to load map markers.";
      setErr(message);
      pushDiag({ category: "markers", message: `exception: ${message}` });
    } finally {
      if (reqSeq === markerReqSeqRef.current) {
        setLoadingMarkers(false);
      }
    }
  }, [pushDiag]);

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
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: false,
        // Prefer a recent cached fix on desktop; it feels much faster and avoids frequent timeouts.
        maximumAge: 900_000,
        timeout: 10_000,
      },
      trackUserLocation: false,
      showUserLocation: true,
      fitBoundsOptions: {
        padding: 48,
        maxZoom: 12,
        animate: false,
      },
    });
    map.addControl(geolocate, "top-right");
    const geolocateButton = map.getContainer().querySelector(
      ".maplibregl-ctrl-geolocate"
    ) as HTMLButtonElement | null;
    const finishLocateAttempt = () => {
      locatingRef.current = false;
      setLocating(false);
    };
    const moveAndRefresh = async (
      lat: number,
      lng: number,
      radiusMiles: number,
      maxZoom: number
    ) => {
      map.fitBounds(boundsForRadiusMeters(lat, lng, radiusMiles * MILES_TO_METERS), {
        padding: 48,
        duration: 450,
        maxZoom,
      });
      await loadMarkers(lat, lng);
    };
    const onGeolocateClick = (evt: MouseEvent) => {
      evt.preventDefault();
      evt.stopImmediatePropagation();
      if (locatingRef.current) {
        pushDiag({ category: "geolocate", message: "ignored extra click (locate already in progress)" });
        return;
      }
      locatingRef.current = true;
      setLocating(true);
      const runId = ++locateReqSeqRef.current;
      geolocateStartRef.current = performance.now();
      pushDiag({ category: "geolocate", message: "locate click" });
      setErr(null);

      void (async () => {
        let coarseLocated = false;
        // Stage 1: Fast/coarse position for immediate UX.
        try {
          const cached = await getBrowserLatLng({
            enableHighAccuracy: false,
            maximumAge: Infinity,
            timeout: 1_200,
          });
          if (runId !== locateReqSeqRef.current) return;
          coarseLocated = true;
          setLocationStatus({
            kind: "approximate",
            detail: `cached browser position, accuracy ${Math.round(cached.accuracy)}m`,
          });
          pushDiag({
            category: "geolocate",
            message: `coarse browser fix in ${Math.round(performance.now() - (geolocateStartRef.current ?? performance.now()))}ms, acc=${Math.round(cached.accuracy)}m`,
          });
          await moveAndRefresh(cached.lat, cached.lng, 35, 11);
        } catch {
          if (runId !== locateReqSeqRef.current) return;
          pushDiag({
            category: "geolocate",
            message: "no quick browser cache; trying IP fallback",
          });
          const approx = await getIpApproxLatLng();
          if (runId !== locateReqSeqRef.current) return;
          if (approx) {
            coarseLocated = true;
            setLocationStatus({
              kind: "approximate",
              detail: `from ${approx.source}`,
            });
            pushDiag({
              category: "geolocate",
              message: `IP fallback ok (${approx.source}) lat=${approx.lat.toFixed(4)} lng=${approx.lng.toFixed(4)}`,
            });
            await moveAndRefresh(approx.lat, approx.lng, 50, 10);
          } else {
            pushDiag({
              category: "geolocate",
              message: "IP fallback unavailable",
            });
          }
        }

        // Stage 2: Refine with precise browser location in background.
        try {
          const precise = await getBrowserLatLng({
            enableHighAccuracy: false,
            maximumAge: 0,
            timeout: 10_000,
          });
          if (runId !== locateReqSeqRef.current) return;
          const elapsed =
            geolocateStartRef.current == null
              ? "n/a"
              : `${Math.round(performance.now() - geolocateStartRef.current)}ms`;
          pushDiag({
            category: "geolocate",
            message: `precise fix in ${elapsed}, acc=${Math.round(precise.accuracy)}m`,
          });
          setLocationStatus({
            kind: "precise",
            detail: `accuracy ${Math.round(precise.accuracy)}m`,
          });
          setErr(null);
          await moveAndRefresh(precise.lat, precise.lng, INITIAL_VIEW_RADIUS_MILES, 12);
        } catch (err) {
          if (runId !== locateReqSeqRef.current) return;
          const code = (err as GeolocationPositionError | undefined)?.code ?? "n/a";
          const elapsed =
            geolocateStartRef.current == null
              ? "n/a"
              : `${Math.round(performance.now() - geolocateStartRef.current)}ms`;
          pushDiag({
            category: "geolocate",
            message: `precise failed code=${code} after ${elapsed}`,
          });
          if (!coarseLocated) {
            setErr(geolocationErrorMessage(err));
          } else {
            setErr("Using approximate location; precise locate is currently unavailable.");
          }
        } finally {
          if (runId === locateReqSeqRef.current) {
            finishLocateAttempt();
          }
        }
      })();
    };
    geolocateButton?.addEventListener("click", onGeolocateClick, { capture: true });

    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      void navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          pushDiag({ category: "permission", message: `geolocation permission=${status.state}` });
          status.onchange = () => {
            pushDiag({
              category: "permission",
              message: `geolocation permission changed=${status.state}`,
            });
          };
        })
        .catch(() => {
          pushDiag({
            category: "permission",
            message: "permissions API unavailable",
          });
        });
    }

    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      // Do not call getCurrentPosition here: it runs in parallel with the Geolocate button and
      // many browsers throttle or drop overlapping geolocation requests.
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
      geolocateButton?.removeEventListener("click", onGeolocateClick, { capture: true });
      locatingRef.current = false;
      if (t) {
        clearTimeout(t);
      }
      markerAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
      interactionsAttachedRef.current = false;
    };
  }, [loadMarkers, pushDiag]);

  if (!isSupabaseConfigured()) {
    return (
      <p className="p-4 text-muted-foreground">
        Configure Supabase in <code className="rounded bg-muted px-1 text-xs text-foreground">.env.local</code> to load the map.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-destructive">{err}</p>}
      {locationStatus.kind !== "none" && (
        <p className="text-xs">
          <span
            className={
              locationStatus.kind === "precise"
                ? "rounded bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                : "rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            }
          >
            {locationStatus.kind === "precise" ? "Precise location" : "Approximate location"}
            {locationStatus.detail ? ` (${locationStatus.detail})` : ""}
          </span>
        </p>
      )}
      <div
        ref={container}
        className="h-[min(70vh,520px)] w-full overflow-hidden rounded-xl border border-border shadow-lg ring-1 ring-foreground/10"
      />
      <p className="text-xs text-muted-foreground">
        Tap the locate button (top-right, below zoom) for your position — view fits ~{INITIAL_VIEW_RADIUS_MILES} mi around you. Pan to explore; pins refresh around the current viewport.{" "}
        {locating ? "Locating… " : ""}
        {loadingMarkers ? "Refreshing pins… " : ""}
        {ready ? "Loaded." : "Loading map…"}
      </p>
      {list.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {list.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href={i.kind === "cafe" ? `/cafe/?id=${i.id}` : `/roaster/?id=${i.id}`}
              >
                {i.name} ({i.kind})
              </Link>
            </li>
          ))}
        </ul>
      )}
      <details className="rounded-xl border border-border bg-card p-2 text-xs text-card-foreground shadow-sm ring-1 ring-foreground/10">
        <summary className="cursor-pointer font-medium text-foreground">
          Location diagnostics ({diag.length})
        </summary>
        {diag.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No diagnostics yet. Tap Locate to collect data.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {diag.map((d, i) => (
              <li key={`${d.at}-${i}`}>
                <span className="font-medium">[{new Date(d.at).toLocaleTimeString()}]</span>{" "}
                <span className="uppercase">{d.category}</span>: {d.message}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
