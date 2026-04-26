"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { slugify } from "@rate-coffee/shared";
import { useAuth } from "./AuthProvider";

type RoasterRow = { id: string; name: string };

function uniqueSlug(name: string) {
  return `${slugify(name)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

type Props = { onChanged: () => void };

export function EntityCreatePanel({ onChanged }: Props) {
  const { user } = useAuth();
  const supabase = useMemo(
    () =>
      typeof window !== "undefined" && isSupabaseConfigured()
        ? getSupabaseBrowserClient()
        : null,
    []
  );
  const [roasters, setRoasters] = useState<RoasterRow[]>([]);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [rName, setRName] = useState("");
  const [cName, setCName] = useState("");
  const [cLat, setCLat] = useState("40.7128");
  const [cLng, setCLng] = useState("-74.0060");
  const [coName, setCoName] = useState("");
  const [coRoaster, setCoRoaster] = useState("");
  const [linkCafe, setLinkCafe] = useState("");
  const [linkRoaster, setLinkRoaster] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!supabase) return;
    const [r, c] = await Promise.all([
      supabase.from("roasters").select("id, name").order("name"),
      supabase.from("cafes").select("id, name").order("name"),
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

  if (!user || !supabase) {
    return null;
  }

  async function addRoaster() {
    if (!supabase) {
      return;
    }
    setMsg(null);
    if (!rName.trim()) {
      setMsg("Roaster name required");
      return;
    }
    const s = uniqueSlug(rName);
    const { error } = await supabase.rpc("create_roaster", {
      p_name: rName.trim(),
      p_slug: s,
      p_lng: null,
      p_lat: null,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setRName("");
    setMsg("Roaster added");
    onChanged();
    void loadCatalog();
  }

  async function addCafe() {
    if (!supabase) {
      return;
    }
    setMsg(null);
    const lat = Number(cLat);
    const lng = Number(cLng);
    if (!cName.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMsg("Cafe name and valid lat/lng required");
      return;
    }
    const s = uniqueSlug(cName);
    const { error } = await supabase.rpc("create_cafe", {
      p_name: cName.trim(),
      p_slug: s,
      p_lat: lat,
      p_lng: lng,
      p_address: null,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setCName("");
    setMsg("Cafe added");
    onChanged();
    void loadCatalog();
  }

  async function addCoffee() {
    if (!supabase || !user) {
      return;
    }
    setMsg(null);
    if (!coName.trim() || !coRoaster) {
      setMsg("Pick a roaster and name the coffee");
      return;
    }
    const uid = user.id;
    const s = uniqueSlug(coName);
    const { error } = await supabase.from("coffees").insert({
      name: coName.trim(),
      slug: s,
      roaster_id: coRoaster,
      created_by: uid,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setCoName("");
    setMsg("Coffee added");
    onChanged();
  }

  async function linkCafeRoaster() {
    if (!supabase || !user) {
      return;
    }
    setMsg(null);
    if (!linkCafe || !linkRoaster) {
      setMsg("Select cafe and roaster");
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
    setMsg("Cafe ↔ roaster linked");
    onChanged();
  }

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-amber-900/10 bg-amber-100/20 p-4">
      <h2 className="font-serif text-lg text-amber-950">Add catalog (US)</h2>
      {msg && <p className="text-sm text-amber-800/90">{msg}</p>}

      <section>
        <h3 className="text-sm font-medium text-amber-900/80">Roaster</h3>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded border border-amber-900/20 bg-white px-2 py-1.5"
            value={rName}
            onChange={(e) => setRName(e.target.value)}
            placeholder="Name"
          />
          <button
            type="button"
            className="rounded bg-amber-800/90 px-3 py-1.5 text-sm text-amber-50"
            onClick={() => void addRoaster()}
          >
            Add
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-amber-900/80">Cafe (with map pin)</h3>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded border border-amber-900/20 bg-white px-2 py-1.5"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            placeholder="Cafe name"
          />
          <div className="flex gap-2">
            <input
              className="w-1/2 rounded border border-amber-900/20 bg-white px-2 py-1.5"
              value={cLat}
              onChange={(e) => setCLat(e.target.value)}
              placeholder="lat"
            />
            <input
              className="w-1/2 rounded border border-amber-900/20 bg-white px-2 py-1.5"
              value={cLng}
              onChange={(e) => setCLng(e.target.value)}
              placeholder="lng"
            />
          </div>
        </div>
        <button
          type="button"
          className="mt-2 rounded bg-amber-800/90 px-3 py-1.5 text-sm text-amber-50"
          onClick={() => void addCafe()}
        >
          Add cafe
        </button>
      </section>

      <section>
        <h3 className="text-sm font-medium text-amber-900/80">Coffee (SKU)</h3>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <select
            className="rounded border border-amber-900/20 bg-white px-2 py-1.5"
            value={coRoaster}
            onChange={(e) => setCoRoaster(e.target.value)}
          >
            {roasters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-[8rem] flex-1 rounded border border-amber-900/20 bg-white px-2 py-1.5"
            value={coName}
            onChange={(e) => setCoName(e.target.value)}
            placeholder="e.g. Ethiopia Yirgacheffe"
          />
          <button
            type="button"
            className="rounded bg-amber-800/90 px-3 py-1.5 text-sm text-amber-50"
            onClick={() => void addCoffee()}
          >
            Add
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-amber-900/80">Cafe serves roaster</h3>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs text-amber-800/80">
            Cafe
            <select
              className="mt-0.5 w-full rounded border border-amber-900/20 bg-white px-2 py-1.5"
              value={linkCafe}
              onChange={(e) => setLinkCafe(e.target.value)}
            >
              {cafes.length === 0 && <option value="">Add a cafe first</option>}
              {cafes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-amber-800/80">
            Roaster
            <select
              className="mt-0.5 w-full rounded border border-amber-900/20 bg-white px-2 py-1.5"
              value={linkRoaster}
              onChange={(e) => setLinkRoaster(e.target.value)}
            >
              {roasters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded bg-amber-800/90 px-3 py-1.5 text-sm text-amber-50"
            onClick={() => void linkCafeRoaster()}
          >
            Link
          </button>
        </div>
      </section>
    </div>
  );
}
