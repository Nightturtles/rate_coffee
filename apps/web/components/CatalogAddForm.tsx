"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  forwardGeocode,
  isMapboxGeocodeConfigured,
  mapboxAddressJson,
  type GeocodeResult,
} from "@/lib/geocode/mapbox";
import { normalizeEntityName, slugify } from "@rate-coffee/shared";
import { Button } from "@/components/ui/button";
import { FilterableSelect } from "@/components/FilterableSelect";
import {
  cardSurfaceClass,
  inputClass,
  selectClass,
  textareaClass,
  tabButtonClass,
} from "@/lib/form-classes";
import { useAuth } from "./AuthProvider";

type RoasterRow = { id: string; name: string; is_verified: boolean };

type Mode = "coffee" | "cafe" | "roaster";

function uniqueSlug(name: string) {
  return `${slugify(name)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

function buildCoffeeCatalogDisplayName(parts: {
  originLabel: string;
  varietyLabel: string;
  producerName: string;
  processLabel: string;
}) {
  return `${parts.originLabel} · ${parts.varietyLabel} · ${parts.producerName} · ${parts.processLabel}`;
}

function MapboxTokenMissingNotice({ variant }: { variant: "café_tab" | "roaster_tab" }) {
  const intro =
    variant === "café_tab"
      ? "Address lookup needs a Mapbox token. Next.js bakes it in at build time, so production needs it in CI—not only on your laptop."
      : "Without a token you can still add a roaster by name. To geocode an HQ address on the deployed site, configure the token below.";

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-950/45 px-3 py-2 text-sm text-amber-50">
      <p>{intro}</p>
      <ul className="list-inside list-disc space-y-0.5 text-xs leading-relaxed text-amber-100/95">
        <li>
          <strong>Local:</strong> set{" "}
          <code className="rounded bg-amber-950/80 px-1 font-mono text-[0.7rem] text-amber-50">
            NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
          </code>{" "}
          in{" "}
          <code className="rounded bg-amber-950/80 px-1 font-mono text-[0.7rem] text-amber-50">
            apps/web/.env.local
          </code>
          , then restart{" "}
          <code className="rounded bg-amber-950/80 px-1 font-mono text-[0.7rem] text-amber-50">npm run dev</code>.
        </li>
        <li>
          <strong>GitHub Pages:</strong> Repository{" "}
          <strong>Settings → Secrets and variables → Actions</strong> → add secret{" "}
          <code className="rounded bg-amber-950/80 px-1 font-mono text-[0.7rem] text-amber-50">
            NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
          </code>
          , then run the Pages workflow again (static export reads env only during{" "}
          <code className="rounded bg-amber-950/80 px-1 font-mono text-[0.7rem] text-amber-50">
            npm run build
          </code>
          ).
        </li>
      </ul>
    </div>
  );
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

  const [coRoaster, setCoRoaster] = useState("");
  const [coffeeOrigins, setCoffeeOrigins] = useState<{ id: string; label: string }[]>([]);
  const [coffeeVarieties, setCoffeeVarieties] = useState<{ id: string; label: string }[]>([]);
  const [coffeeProcesses, setCoffeeProcesses] = useState<{ id: string; label: string }[]>([]);
  const [coOrigin, setCoOrigin] = useState("");
  const [coVariety, setCoVariety] = useState("");
  const [coProcess, setCoProcess] = useState("");
  const [producerRows, setProducerRows] = useState<{ id: string; name: string }[]>([]);
  const [coProducerId, setCoProducerId] = useState<string | undefined>(undefined);
  const [coProducerDraft, setCoProducerDraft] = useState("");
  /** Bump after successful add so the producer combobox remounts with empty draft. */
  const [producerRemountKey, setProducerRemountKey] = useState(0);
  const [linkCafe, setLinkCafe] = useState("");
  const [linkRoaster, setLinkRoaster] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const producerFetchGen = useRef(0);

  const loadCatalog = useCallback(async () => {
    if (!supabase) return;
    const [r, c, o, v, p] = await Promise.all([
      supabase.from("roasters").select("id, name, is_verified").order("name"),
      supabase.from("cafes").select("id, name, is_verified").order("name"),
      supabase.from("coffee_origins").select("id, label").order("sort_order", { ascending: true }),
      supabase.from("coffee_varieties").select("id, label").order("sort_order", { ascending: true }),
      supabase.from("coffee_processes").select("id, label").order("sort_order", { ascending: true }),
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
    if (o.data) {
      setCoffeeOrigins(o.data);
    }
    if (v.data) {
      setCoffeeVarieties(v.data);
    }
    if (p.data) {
      setCoffeeProcesses(p.data);
    }
  }, [supabase]);

  const loadProducersForOrigin = useCallback(
    async (originId: string) => {
      if (!supabase || !originId) {
        producerFetchGen.current += 1;
        setProducerRows([]);
        return;
      }
      const gen = ++producerFetchGen.current;
      const { data } = await supabase
        .from("coffee_producers")
        .select("id, name")
        .eq("origin_id", originId)
        .order("name", { ascending: true });
      if (gen !== producerFetchGen.current) return;
      setProducerRows(data ?? []);
    },
    [supabase]
  );

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    setCoProducerId(undefined);
    setCoProducerDraft("");
    void loadProducersForOrigin(coOrigin);
  }, [coOrigin, loadProducersForOrigin]);

  const onProducerDraftChange = useCallback((d: string) => {
    setCoProducerDraft(d);
  }, []);

  const producerOptions = useMemo(
    () => producerRows.map((p) => ({ id: p.id, label: p.name })),
    [producerRows]
  );

  const pickedRoasterGeo = rGeoHits[rGeoPick] ?? null;
  const pickedCafeGeo = cGeoHits[cGeoPick] ?? null;

  async function resolveRoasterAddress() {
    setMsg(null);
    if (!mapboxOk) {
      setMsg("Mapbox token is not configured — see the setup note on this form.");
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
      setMsg("Mapbox token is not configured — see the setup note on this form.");
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

  async function ensureProducerRow(originId: string, nameTrim: string): Promise<{ id: string } | { error: string }> {
    if (!supabase || !user) return { error: "Not signed in." };
    const norm = normalizeEntityName(nameTrim);
    if (!norm) return { error: "Producer name required." };

    const { data: existing } = await supabase
      .from("coffee_producers")
      .select("id")
      .eq("origin_id", originId)
      .eq("normalized_name", norm)
      .maybeSingle();
    if (existing?.id) return { id: existing.id };

    const { data: inserted, error } = await supabase
      .from("coffee_producers")
      .insert({ origin_id: originId, name: nameTrim.trim(), created_by: user.id })
      .select("id")
      .single();

    if (!error && inserted?.id) return { id: inserted.id };

    if (error?.code === "23505") {
      const { data: again } = await supabase
        .from("coffee_producers")
        .select("id")
        .eq("origin_id", originId)
        .eq("normalized_name", norm)
        .maybeSingle();
      if (again?.id) return { id: again.id };
    }

    return { error: error?.message ?? "Could not save producer." };
  }

  async function addCoffee() {
    if (!supabase || !user) return;
    setMsg(null);
    if (!coRoaster || !coOrigin || !coVariety || !coProcess) {
      setMsg("Pick origin, variety, process, and roaster.");
      return;
    }

    const originLabel = coffeeOrigins.find((o) => o.id === coOrigin)?.label ?? "";
    const varietyLabel = coffeeVarieties.find((v) => v.id === coVariety)?.label ?? "";
    const processLabel = coffeeProcesses.find((p) => p.id === coProcess)?.label ?? "";

    let producerResolvedId: string;
    let producerDisplayName: string;
    if (coProducerId) {
      producerResolvedId = coProducerId;
      producerDisplayName = producerRows.find((r) => r.id === coProducerId)?.name ?? "";
      if (!producerDisplayName) {
        setMsg("Could not resolve producer name.");
        return;
      }
    } else {
      const raw = coProducerDraft.trim();
      if (!raw) {
        setMsg("Enter or choose a producer.");
        return;
      }
      const ensured = await ensureProducerRow(coOrigin, raw);
      if ("error" in ensured) {
        setMsg(ensured.error);
        return;
      }
      producerResolvedId = ensured.id;
      producerDisplayName = raw.trim();
    }

    const displayName = buildCoffeeCatalogDisplayName({
      originLabel,
      varietyLabel,
      producerName: producerDisplayName,
      processLabel,
    });

    const normalized = normalizeEntityName(displayName);
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
    const s = uniqueSlug(displayName);
    const { error } = await supabase.from("coffees").insert({
      name: displayName,
      slug: s,
      roaster_id: coRoaster,
      origin_id: coOrigin,
      variety_id: coVariety,
      producer_id: producerResolvedId,
      process_id: coProcess,
      created_by: uid,
      is_verified: false,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setCoProducerId(undefined);
    setCoProducerDraft("");
    setProducerRemountKey((k) => k + 1);
    setMsg("Coffee added.");
    onChanged?.();
    void loadProducersForOrigin(coOrigin);
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
    <div className={`space-y-4 ${cardSurfaceClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-serif text-lg text-foreground">Add catalog</span>
        <span className="text-xs text-muted-foreground">(US)</span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
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

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {mode === "coffee" && (
        <>
          <section>
            <h3 className="text-sm font-medium text-foreground">Coffee (SKU)</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-foreground">
                Roaster
                <select
                  className={`mt-0.5 w-full ${selectClass}`}
                  value={coRoaster}
                  onChange={(e) => setCoRoaster(e.target.value)}
                >
                  {roasters.length === 0 && <option value="">Add a roaster first</option>}
                  {roasters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.is_verified ? "✓" : "(unverified)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-foreground">
                Origin
                <select
                  className={`mt-0.5 w-full ${selectClass}`}
                  value={coOrigin}
                  onChange={(e) => setCoOrigin(e.target.value)}
                >
                  {coffeeOrigins.length === 0 ? (
                    <option value="">Run DB migrations (coffee_origins)</option>
                  ) : (
                    <>
                      <option value="">Select origin…</option>
                      {coffeeOrigins.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
              <label className="text-xs font-medium text-foreground">
                Variety
                <select
                  className={`mt-0.5 w-full ${selectClass}`}
                  value={coVariety}
                  onChange={(e) => setCoVariety(e.target.value)}
                >
                  {coffeeVarieties.length === 0 ? (
                    <option value="">Run DB migrations (coffee_varieties)</option>
                  ) : (
                    <>
                      <option value="">Select variety…</option>
                      {coffeeVarieties.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
              <label className="text-xs font-medium text-foreground">
                Process
                <select
                  className={`mt-0.5 w-full ${selectClass}`}
                  value={coProcess}
                  onChange={(e) => setCoProcess(e.target.value)}
                >
                  {coffeeProcesses.length === 0 ? (
                    <option value="">Run DB migrations (coffee_processes)</option>
                  ) : (
                    <>
                      <option value="">Select process…</option>
                      {coffeeProcesses.map((proc) => (
                        <option key={proc.id} value={proc.id}>
                          {proc.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
              <label className="text-xs font-medium text-foreground sm:col-span-2">
                Producer
                <span className="mt-0.5 block font-normal text-muted-foreground">
                  Filtered by origin. Type a new name to add a producer for this origin.
                </span>
                <FilterableSelect
                  key={`producer-${coOrigin}-${producerRemountKey}`}
                  id="catalog-coffee-producer"
                  options={producerOptions}
                  value={coProducerId}
                  onValueChange={setCoProducerId}
                  onDraftChange={onProducerDraftChange}
                  placeholder={coOrigin ? "Type or pick a producer…" : "Select an origin first"}
                  disabled={!coOrigin}
                  emptyText={coOrigin ? "No producers yet — type a name to add one" : "Select an origin first"}
                />
              </label>
            </div>
            <div className="mt-3">
              <Button type="button" size="sm" onClick={() => void addCoffee()}>
                Add coffee
              </Button>
            </div>
          </section>

          <section className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-foreground">Link café ↔ roaster</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Record that a café serves beans from a roaster (separate from check-ins).
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-xs font-medium text-foreground">
                Café
                <select
                  className={`mt-0.5 w-full ${selectClass}`}
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
              <label className="text-xs font-medium text-foreground">
                Roaster
                <select
                  className={`mt-0.5 w-full ${selectClass}`}
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
              <Button type="button" size="sm" onClick={() => void linkCafeRoaster()}>
                Link
              </Button>
            </div>
          </section>
        </>
      )}

      {mode === "cafe" && (
        <section>
          <h3 className="text-sm font-medium text-foreground">Café</h3>
          {!mapboxOk && <MapboxTokenMissingNotice variant="café_tab" />}
          <div className="mt-2 grid gap-2">
            <input className={inputClass} value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Café name" />
            <textarea
              className={textareaClass}
              value={cAddr}
              onChange={(e) => {
                setCAddr(e.target.value);
                setCGeoHits([]);
                setCGeoPick(0);
              }}
              placeholder="Street address, city, state..."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={cGeoBusy || !mapboxOk}
                onClick={() => void resolveCafeAddress()}
              >
                {cGeoBusy ? "Looking up…" : "Look up address"}
              </Button>
            </div>
            {cGeoHits.length > 1 && (
              <label className="text-xs font-medium text-foreground">
                Match
                <select
                  className={`mt-0.5 w-full ${selectClass}`}
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
              <p className="text-xs text-muted-foreground">
                Using: <span className="font-medium text-foreground">{pickedCafeGeo.label}</span>
              </p>
            )}
            <Button
              type="button"
              size="sm"
              className="w-fit"
              disabled={cSubmitBusy || !pickedCafeGeo}
              onClick={() => void addCafe()}
            >
              {cSubmitBusy ? "Saving…" : "Add café"}
            </Button>
            <p className="text-[10px] leading-snug text-muted-foreground">
              © Mapbox © OpenStreetMap contributors — Geocoding lookup only (no live autocomplete).
            </p>
          </div>
        </section>
      )}

      {mode === "roaster" && (
        <section>
          <h3 className="text-sm font-medium text-foreground">Roaster</h3>
          <div className="mt-2 grid gap-3">
            <input className={inputClass} value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Roaster name" />
            <div>
              <p className="text-xs text-muted-foreground">Optional HQ address (geocoded for map pin)</p>
              {!mapboxOk && <MapboxTokenMissingNotice variant="roaster_tab" />}
              <textarea
                className={`mt-1 w-full ${textareaClass}`}
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
                <Button
                  type="button"
                  size="sm"
                  disabled={rGeoBusy || !mapboxOk || !rAddr.trim()}
                  onClick={() => void resolveRoasterAddress()}
                >
                  {rGeoBusy ? "Looking up…" : "Look up address"}
                </Button>
              </div>
              {rGeoHits.length > 1 && (
                <label className="mt-2 block text-xs font-medium text-foreground">
                  Match
                  <select
                    className={`mt-0.5 w-full ${selectClass}`}
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
                <p className="mt-2 text-xs text-muted-foreground">
                  Using: <span className="font-medium text-foreground">{pickedRoasterGeo.label}</span>
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0"
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
                className={inputClass}
                value={rCafeName}
                onChange={(e) => setRCafeName(e.target.value)}
                placeholder="Café name (defaults to roaster name)"
              />
            )}

            <Button type="button" size="sm" className="w-fit" disabled={rSubmitBusy} onClick={() => void addRoaster()}>
              {rSubmitBusy ? "Saving…" : "Add roaster"}
            </Button>
            <p className="text-[10px] leading-snug text-muted-foreground">
              © Mapbox © OpenStreetMap contributors — Geocoding lookup only (no live autocomplete).
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
