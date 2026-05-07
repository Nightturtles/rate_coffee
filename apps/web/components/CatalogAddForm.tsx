"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  forwardGeocode,
  isMapboxGeocodeConfigured,
  mapboxAddressJson,
  type GeocodeResult,
} from "@/lib/geocode/mapbox";
import { slugify } from "@rate-coffee/shared";
import { useAuth } from "./AuthProvider";

type RoasterRow = { id: string; name: string; is_verified: boolean };

type Mode = "coffee" | "cafe" | "roaster";

function uniqueSlug(name: string) {
  return `${slugify(name)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

function tabButtonClass(active: boolean) {
  return active
    ? "rounded-md bg-sage-600 px-3 py-1.5 text-sm font-medium text-sage-50"
    : "rounded-md px-3 py-1.5 text-sm font-medium text-sage-700 hover:bg-sage-200/60";
}

type Props = { onChanged?: () => void };

export function CatalogAddForm({ onChanged }: Props) {
  const { user } = useAuth();
  const supabase = useMemo(
    () =>
      typeof window !== "undefined" && isSupabaseConfigured()
        ? getSupabaseBrowserClient()
        : null,
    []
  );

  const mapboxOk = useMemo(() => isMapboxGeocodeConfigured(), []);

  const [mode, setMode] = useState<Mode>("coffee");
  const [roasters, setRoasters] = useState<RoasterRow[]>([]);
  const [cafes, setCafes] = useState<{ id: string; name: string; is_verified: boolean }[]>([]);

  const [rName, setRName] = useState("");
  const [rAddr, setRAddr] = useState("");
  const [rGeoBusy, setRGeoBusy] = useState(false);
  const [rGeoHits, setRGeoHits] = useState<GeocodeResult[]>([]);
  const [rGeoPick, setRGeoPick] = useState(0);
  const [rAlsoCafe, setRAlsoCafe] = useState(false);
  const [rCafeName, setRCafeName] = useState("");
  const [rSubmitBusy, setRSubmitBusy] = useState(false);

  const [cName, setCName] = useState("");
  const [cAddr, setCAddr] = useState("");
  const [cGeoBusy, setCGeoBusy] = useState(false);
  const [cGeoHits, setCGeoHits] = useState<GeocodeResult[]>([]);
  const [cGeoPick, setCGeoPick] = useState(0);
  const [cSubmitBusy, setCSubmitBusy] = useState(false);

  const [coName, setCoName] = useState("");
  const [coRoaster, setCoRoaster] = useState("");
  const [linkCafe, setLinkCafe] = useState("");
  const [linkRoaster, setLinkRoaster] = useState("");

  const [msg, setMsg] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!supabase) return;
    const [r, c] = await Promise.all([
      supabase.from("roasters").select("id, name, is_verified").order("name"),
      supabase.from("cafes").select("id, name, is_verified").order("name"),
    ]);
    if (r.data) {
      setRoasters(r.data);
      setCoRoaster((prev) => prev || (r.data![0]?.id ?? ""));
      setLinkRoaster((prev) => prev || (r.data![0]?.id ?? ""));
    }
    if (c.data) {
      setCafes(c.data);
      setLinkCafe((prev) => prev || (c.data![0]?.id ?? ""));
    }
  }, [supabase]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const pickedRoasterGeo = rGeoHits[rGeoPick] ?? null;
  const pickedCafeGeo = cGeoHits[cGeoPick] ?? null;

  async function resolveRoasterAddress() {
    setMsg(null);
    if (!mapboxOk) {
      setMsg("Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to resolve addresses.");
      return;
    }
    const q = rAddr.trim();
    if (!q) {
      setMsg("Enter an address first.");
      return;
    }
    setRGeoBusy(true);
    try {
      const hits = await forwardGeocode(q);
      setRGeoHits(hits);
      setRGeoPick(0);
    } catch (e) {
      setRGeoHits([]);
      setMsg(e instanceof Error ? e.message : "Could not resolve address.");
    } finally {
      setRGeoBusy(false);
    }
  }

  async function resolveCafeAddress() {
    setMsg(null);
    if (!mapboxOk) {
      setMsg("Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to resolve addresses.");
      return;
    }
    const q = cAddr.trim();
    if (!q) {
      setMsg("Enter an address first.");
      return;
    }
    setCGeoBusy(true);
    try {
      const hits = await forwardGeocode(q);
      setCGeoHits(hits);
      setCGeoPick(0);
    } catch (e) {
      setCGeoHits([]);
      setMsg(e instanceof Error ? e.message : "Could not resolve address.");
    } finally {
      setCGeoBusy(false);
    }
  }

  async function addRoaster() {
    if (!supabase || !user) return;
    setMsg(null);
    const nameTrim = rName.trim();
    if (!nameTrim) {
      setMsg("Roaster name required.");
      return;
    }

    const addrTrim = rAddr.trim();
    if (addrTrim && rGeoHits.length === 0) {
      setMsg('Resolve the address with “Look up address”, or clear the address field.');
      return;
    }

    let lat: number | null = null;
    let lng: number | null = null;
    let addrJson: Record<string, unknown> | null = null;

    if (pickedRoasterGeo) {
      lat = pickedRoasterGeo.lat;
      lng = pickedRoasterGeo.lng;
      addrJson = mapboxAddressJson(pickedRoasterGeo);
    }

    if (addrTrim && (!pickedRoasterGeo || lat === null || lng === null)) {
      setMsg('Resolve the address with “Look up address”.');
      return;
    }

    if (rAlsoCafe) {
      if (!pickedRoasterGeo) {
        setMsg('Resolve an address and enable “Also a café” only when the location is known.');
        return;
      }
      const cafeLabel = rCafeName.trim() || nameTrim;
      if (!cafeLabel) {
        setMsg("Café name required when adding both.");
        return;
      }
    }

    setRSubmitBusy(true);
    try {
      const slugRoaster = uniqueSlug(nameTrim);
      const { data: roRow, error: roErr } = await supabase.rpc("create_roaster", {
        p_name: nameTrim,
        p_slug: slugRoaster,
        p_lng: lng,
        p_lat: lat,
        p_address: addrJson,
      });
      if (roErr) {
        setMsg(roErr.message);
        return;
      }
      if (!roRow || typeof roRow !== "object" || !("id" in roRow)) {
        setMsg("Roaster saved but response was unexpected.");
        return;
      }
      const roasterId = (roRow as { id: string }).id;

      if (rAlsoCafe && pickedRoasterGeo) {
        const cafeLabel = rCafeName.trim() || nameTrim;
        const slugCafe = uniqueSlug(cafeLabel);
        const cafePayload = mapboxAddressJson(pickedRoasterGeo);
        const { data: cafeRow, error: cafeErr } = await supabase.rpc("create_cafe", {
          p_name: cafeLabel,
          p_slug: slugCafe,
          p_lat: pickedRoasterGeo.lat,
          p_lng: pickedRoasterGeo.lng,
          p_address: cafePayload,
        });
        if (cafeErr) {
          setMsg(`Roaster added, but café failed: ${cafeErr.message}`);
          onChanged?.();
          void loadCatalog();
          return;
        }
        const cafeId =
          cafeRow && typeof cafeRow === "object" && "id" in cafeRow
            ? (cafeRow as { id: string }).id
            : null;
        if (!cafeId) {
          setMsg("Roaster added; café response missing id.");
          onChanged?.();
          void loadCatalog();
          return;
        }
        const { error: linkErr } = await supabase.from("cafe_roaster").insert({
          cafe_id: cafeId,
          roaster_id: roasterId,
          created_by: user.id,
        });
        if (linkErr) {
          setMsg(`Roaster and café added, but link failed: ${linkErr.message}`);
        } else {
          setMsg("Roaster added; café at same location linked.");
        }
      } else {
        setMsg("Roaster added.");
      }

      setRName("");
      setRAddr("");
      setRGeoHits([]);
      setRGeoPick(0);
      setRAlsoCafe(false);
      setRCafeName("");
      onChanged?.();
      void loadCatalog();
    } finally {
      setRSubmitBusy(false);
    }
  }

  async function addCafe() {
    if (!supabase || !user) return;
    setMsg(null);
    if (!cName.trim()) {
      setMsg("Café name required.");
      return;
    }
    if (!pickedCafeGeo) {
      setMsg('Look up an address before adding the café.');
      return;
    }
    setCSubmitBusy(true);
    try {
      const slug = uniqueSlug(cName.trim());
      const payload = mapboxAddressJson(pickedCafeGeo);
      const { error } = await supabase.rpc("create_cafe", {
        p_name: cName.trim(),
        p_slug: slug,
        p_lat: pickedCafeGeo.lat,
        p_lng: pickedCafeGeo.lng,
        p_address: payload,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      setCName("");
      setCAddr("");
      setCGeoHits([]);
      setCGeoPick(0);
      setMsg("Café added.");
      onChanged?.();
      void loadCatalog();
    } finally {
      setCSubmitBusy(false);
    }
  }

  async function addCoffee() {
    if (!supabase || !user) return;
    setMsg(null);
    if (!coName.trim() || !coRoaster) {
      setMsg("Pick a roaster and name the coffee.");
      return;
    }
    const normalized = coName.trim().toLowerCase().replace(/\s+/g, " ");
    const { data: dup } = await supabase
      .from("coffees")
      .select("id")
      .eq("roaster_id", coRoaster)
      .eq("normalized_name", normalized)
      .limit(1);
    if (dup && dup.length > 0) {
      setMsg("A similar coffee already exists for this roaster.");
      return;
    }
    const uid = user.id;
    const s = uniqueSlug(coName);
    const { error } = await supabase.from("coffees").insert({
      name: coName.trim(),
      slug: s,
      roaster_id: coRoaster,
      created_by: uid,
      is_verified: false,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setCoName("");
    setMsg("Coffee added.");
    onChanged?.();
  }

  async function linkCafeRoaster() {
    if (!supabase || !user) return;
    setMsg(null);
    if (!linkCafe || !linkRoaster) {
      setMsg("Select café and roaster.");
      return;
    }
    const { error } = await supabase.from("cafe_roaster").insert({
      cafe_id: linkCafe,
      roaster_id: linkRoaster,
      created_by: user.id,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Café ↔ roaster linked.");
    onChanged?.();
  }

  if (!user || !supabase) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-sage-200 bg-sage-50 p-4 text-sage-900 shadow-xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-serif text-lg text-sage-900">Add catalog</span>
        <span className="text-xs text-sage-600">(US)</span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-sage-200 pb-3">
        <button type="button" className={tabButtonClass(mode === "coffee")} onClick={() => setMode("coffee")}>
          Coffee
        </button>
        <button type="button" className={tabButtonClass(mode === "cafe")} onClick={() => setMode("cafe")}>
          Café
        </button>
        <button type="button" className={tabButtonClass(mode === "roaster")} onClick={() => setMode("roaster")}>
          Roaster
        </button>
      </div>

      {msg && <p className="text-sm text-sage-700">{msg}</p>}

      {mode === "coffee" && (
        <>
          <section>
            <h3 className="text-sm font-medium text-sage-700">Coffee (SKU)</h3>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <select
                className="rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                value={coRoaster}
                onChange={(e) => setCoRoaster(e.target.value)}
              >
                {roasters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.is_verified ? "✓" : "(unverified)"}
                  </option>
                ))}
              </select>
              <input
                className="min-w-[8rem] flex-1 rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                value={coName}
                onChange={(e) => setCoName(e.target.value)}
                placeholder="e.g. Ethiopia Yirgacheffe"
              />
              <button
                type="button"
                className="rounded bg-sage-600 px-3 py-1.5 text-sm text-sage-50 hover:bg-sage-700"
                onClick={() => void addCoffee()}
              >
                Add coffee
              </button>
            </div>
          </section>

          <section className="border-t border-sage-200 pt-4">
            <h3 className="text-sm font-medium text-sage-700">Link café ↔ roaster</h3>
            <p className="mt-0.5 text-xs text-sage-600">
              Record that a café serves beans from a roaster (separate from check-ins).
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-xs text-sage-700">
                Café
                <select
                  className="mt-0.5 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                  value={linkCafe}
                  onChange={(e) => setLinkCafe(e.target.value)}
                >
                  {cafes.length === 0 && <option value="">Add a café first</option>}
                  {cafes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.is_verified ? "✓" : "(unverified)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-sage-700">
                Roaster
                <select
                  className="mt-0.5 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                  value={linkRoaster}
                  onChange={(e) => setLinkRoaster(e.target.value)}
                >
                  {roasters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.is_verified ? "✓" : "(unverified)"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded bg-sage-600 px-3 py-1.5 text-sm text-sage-50 hover:bg-sage-700"
                onClick={() => void linkCafeRoaster()}
              >
                Link
              </button>
            </div>
          </section>
        </>
      )}

      {mode === "cafe" && (
        <section>
          <h3 className="text-sm font-medium text-sage-700">Café</h3>
          {!mapboxOk && (
            <p className="mt-2 text-sm text-amber-800">
              Set <code className="rounded bg-sage-200 px-1">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in{" "}
              <code className="rounded bg-sage-200 px-1">.env.local</code> to turn an address into map coordinates.
            </p>
          )}
          <div className="mt-2 grid gap-2">
            <input
              className="rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="Café name"
            />
            <textarea
              className="min-h-[4rem] rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
              value={cAddr}
              onChange={(e) => {
                setCAddr(e.target.value);
                setCGeoHits([]);
                setCGeoPick(0);
              }}
              placeholder="Street address, city, state..."
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={cGeoBusy || !mapboxOk}
                className="rounded bg-sage-600 px-3 py-1.5 text-sm text-sage-50 hover:bg-sage-700 disabled:opacity-50"
                onClick={() => void resolveCafeAddress()}
              >
                {cGeoBusy ? "Looking up…" : "Look up address"}
              </button>
            </div>
            {cGeoHits.length > 1 && (
              <label className="text-xs text-sage-700">
                Match
                <select
                  className="mt-0.5 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                  value={cGeoPick}
                  onChange={(e) => setCGeoPick(Number(e.target.value))}
                >
                  {cGeoHits.map((h, i) => (
                    <option key={i} value={i}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {pickedCafeGeo && (
              <p className="text-xs text-sage-600">
                Using: <span className="font-medium text-sage-800">{pickedCafeGeo.label}</span>
              </p>
            )}
            <button
              type="button"
              disabled={cSubmitBusy || !pickedCafeGeo}
              className="w-fit rounded bg-sage-600 px-3 py-1.5 text-sm text-sage-50 hover:bg-sage-700 disabled:opacity-50"
              onClick={() => void addCafe()}
            >
              {cSubmitBusy ? "Saving…" : "Add café"}
            </button>
            <p className="text-[10px] leading-snug text-sage-500">
              © Mapbox © OpenStreetMap contributors — Geocoding lookup only (no live autocomplete).
            </p>
          </div>
        </section>
      )}

      {mode === "roaster" && (
        <section>
          <h3 className="text-sm font-medium text-sage-700">Roaster</h3>
          <div className="mt-2 grid gap-3">
            <input
              className="rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
              value={rName}
              onChange={(e) => setRName(e.target.value)}
              placeholder="Roaster name"
            />
            <div>
              <p className="text-xs text-sage-600">Optional HQ address (geocoded for map pin)</p>
              {!mapboxOk && (
                <p className="mt-1 text-xs text-amber-800">
                  Without a Mapbox token you can still add a roaster by name only.
                </p>
              )}
              <textarea
                className="mt-1 min-h-[4rem] w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                value={rAddr}
                onChange={(e) => {
                  setRAddr(e.target.value);
                  setRGeoHits([]);
                  setRGeoPick(0);
                  setRAlsoCafe(false);
                }}
                placeholder="Leave blank if unknown"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={rGeoBusy || !mapboxOk || !rAddr.trim()}
                  className="rounded bg-sage-600 px-3 py-1.5 text-sm text-sage-50 hover:bg-sage-700 disabled:opacity-50"
                  onClick={() => void resolveRoasterAddress()}
                >
                  {rGeoBusy ? "Looking up…" : "Look up address"}
                </button>
              </div>
              {rGeoHits.length > 1 && (
                <label className="mt-2 block text-xs text-sage-700">
                  Match
                  <select
                    className="mt-0.5 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                    value={rGeoPick}
                    onChange={(e) => setRGeoPick(Number(e.target.value))}
                  >
                    {rGeoHits.map((h, i) => (
                      <option key={i} value={i}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {pickedRoasterGeo && (
                <p className="mt-2 text-xs text-sage-600">
                  Using: <span className="font-medium text-sage-800">{pickedRoasterGeo.label}</span>
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-sm text-sage-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={rAlsoCafe}
                disabled={!pickedRoasterGeo}
                onChange={(e) => {
                  const on = e.target.checked;
                  setRAlsoCafe(on);
                  if (on && !rCafeName.trim() && rName.trim()) {
                    setRCafeName(rName.trim());
                  }
                }}
              />
              <span>This location is also a café (creates a café record at the same coordinates)</span>
            </label>
            {rAlsoCafe && (
              <input
                className="rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
                value={rCafeName}
                onChange={(e) => setRCafeName(e.target.value)}
                placeholder="Café name (defaults to roaster name)"
              />
            )}

            <button
              type="button"
              disabled={rSubmitBusy}
              className="w-fit rounded bg-sage-600 px-3 py-1.5 text-sm text-sage-50 hover:bg-sage-700 disabled:opacity-50"
              onClick={() => void addRoaster()}
            >
              {rSubmitBusy ? "Saving…" : "Add roaster"}
            </button>
            <p className="text-[10px] leading-snug text-sage-500">
              © Mapbox © OpenStreetMap contributors — Geocoding lookup only (no live autocomplete).
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
