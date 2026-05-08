"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { checkInFormSchema, RATING_MAX, RATING_MIN, RATING_STEP } from "@rate-coffee/shared";
import { useAuth } from "./AuthProvider";
import type { CheckInFormValues } from "@rate-coffee/shared";

const ratings: number[] = [];
for (let n = RATING_MIN; n <= RATING_MAX + 1e-6; n += RATING_STEP) {
  ratings.push(n);
}

type Option = { id: string; label: string };

type Props = {
  onCheckIn: () => void;
};

type FormState = Partial<CheckInFormValues> & { roasterId?: string };

export function CheckInForm({ onCheckIn }: Props) {
  const { user } = useAuth();
  const [brewMethods, setBrewMethods] = useState<Option[]>([]);
  const [tags, setTags] = useState<Option[]>([]);
  const [roasters, setRoasters] = useState<Option[]>([]);
  const [coffees, setCoffees] = useState<{ id: string; label: string; roasterId: string }[]>([]);
  const [cafes, setCafes] = useState<Option[]>([]);
  const [coffeeFilter, setCoffeeFilter] = useState("");
  const [cafeFilter, setCafeFilter] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<FormState>({
    context: "home",
    tagIds: [],
    visibility: "public",
  });

  const supabase = useMemo(
    () =>
      typeof window !== "undefined" && isSupabaseConfigured()
        ? getSupabaseBrowserClient()
        : null,
    []
  );

  const load = useCallback(async () => {
    if (!user || !supabase) return;
    const [bm, tg, ro, co, ca] = await Promise.all([
      supabase.from("brew_methods").select("id, label, sort_order").order("sort_order", { ascending: true }),
      supabase.from("tags").select("id, label, sort_order").order("sort_order", { ascending: true }),
      supabase.from("roasters").select("id, name").order("name", { ascending: true }),
      supabase
        .from("coffees")
        .select("id, name, roaster_id, roaster:roasters!roaster_id ( name )")
        .order("name", { ascending: true }),
      supabase.from("cafes").select("id, name").order("name", { ascending: true }),
    ]);
    if (bm.data) {
      setBrewMethods(
        bm.data.map((r: { id: string; label: string }) => ({ id: r.id, label: r.label }))
      );
    }
    if (tg.data) {
      setTags(
        tg.data.map((r: { id: string; label: string }) => ({ id: r.id, label: r.label }))
      );
    }
    if (ro.data) {
      setRoasters(
        ro.data.map((r: { id: string; name: string }) => ({ id: r.id, label: r.name }))
      );
    }
    if (co.data) {
      setCoffees(
        co.data.map((r) => {
          const row = r as {
            id: string;
            name: string;
            roaster_id: string;
            roaster: { name: string } | { name: string }[] | null;
          };
          const rn = Array.isArray(row.roaster) ? row.roaster[0]?.name : row.roaster?.name;
          return { id: row.id, label: `${row.name} — ${rn ?? "roaster"}`, roasterId: row.roaster_id };
        })
      );
    }
    if (ca.data) {
      setCafes(
        ca.data.map((r: { id: string; name: string }) => ({ id: r.id, label: r.name }))
      );
    }
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCoffees = useMemo(() => {
    const q = coffeeFilter.trim().toLowerCase();
    return coffees.filter((c) => {
      const matchesRoaster = !f.roasterId || c.roasterId === f.roasterId;
      const matchesText = q.length === 0 || c.label.toLowerCase().includes(q);
      return matchesRoaster && matchesText;
    });
  }, [coffeeFilter, coffees, f.roasterId]);

  const filteredCafes = useMemo(() => {
    const q = cafeFilter.trim().toLowerCase();
    if (q.length === 0) return cafes;
    return cafes.filter((c) => c.label.toLowerCase().includes(q));
  }, [cafeFilter, cafes]);

  if (!user) {
    return (
      <p className="text-sm text-sage-100">
        <a className="underline" href="/login/">
          Log in
        </a>{" "}
        to log a coffee.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !supabase) return;
    setStatus(null);
    setBusy(true);
    const parse = checkInFormSchema.safeParse({ ...f, context: f.context ?? "home" });
    if (!parse.success) {
      setStatus(parse.error.errors[0]?.message ?? "Check form");
      setBusy(false);
      return;
    }
    const v = parse.data;
    const { data: ins, error: e1 } = await supabase
      .from("check_ins")
      .insert({
        user_id: user.id,
        coffee_id: v.coffeeId,
        cafe_id: v.context === "cafe" ? v.cafeId! : null,
        context: v.context,
        brew_method_id: v.brewMethodId,
        rating: v.rating,
        notes: v.notes || null,
        visibility: v.visibility,
      })
      .select("id")
      .single();
    if (e1) {
      setStatus(e1.message);
      setBusy(false);
      return;
    }
    if (v.tagIds.length > 0 && ins?.id) {
      for (const tid of v.tagIds) {
        const { error: e2 } = await supabase
          .from("check_in_tags")
          .insert({ check_in_id: ins.id, tag_id: tid });
        if (e2) {
          setStatus(e2.message);
          setBusy(false);
          return;
        }
      }
    }
    setF({
      context: f.context,
      tagIds: [],
      visibility: v.visibility,
    });
    setCoffeeFilter("");
    setCafeFilter("");
    setStatus("Saved");
    onCheckIn();
    setBusy(false);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 rounded-lg border border-sage-200 bg-sage-50 p-4 text-sage-900 shadow-xl">
      <h2 className="font-serif text-lg text-sage-900">New check-in</h2>
      <label className="text-xs font-medium text-sage-700">
        Roaster
        <select
          required
          className="mt-1 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
          value={f.roasterId ?? ""}
          onChange={(e) =>
            setF((o) => ({
              ...o,
              roasterId: e.target.value,
              coffeeId: coffees.find((c) => c.id === o.coffeeId && c.roasterId === e.target.value)
                ? o.coffeeId
                : undefined,
            }))
          }
        >
          <option value="">Select…</option>
          {roasters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-sage-700">
        Coffee
        <input
          type="text"
          className="mt-1 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
          placeholder="Type to filter coffees…"
          value={coffeeFilter}
          onChange={(e) => setCoffeeFilter(e.target.value)}
        />
        <select
          required
          className="mt-1 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
          value={f.coffeeId ?? ""}
          onChange={(e) => setF((o) => ({ ...o, coffeeId: e.target.value }))}
        >
          <option value="">Select…</option>
          {filteredCoffees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="text-xs font-medium text-sage-700">
        Where
        <div className="mt-1 flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="context"
              checked={f.context === "home"}
              onChange={() => setF((o) => ({ ...o, context: "home", cafeId: null }))}
            />
            Home
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="context"
              checked={f.context === "cafe"}
              onChange={() => setF((o) => ({ ...o, context: "cafe" }))}
            />
            Cafe
          </label>
        </div>
        {f.context === "cafe" && (
          <>
            <input
              type="text"
              className="mt-2 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
              placeholder="Type to filter cafes…"
              value={cafeFilter}
              onChange={(e) => setCafeFilter(e.target.value)}
            />
            <select
              className="mt-2 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
              required
              value={f.cafeId ?? ""}
              onChange={(e) => setF((o) => ({ ...o, cafeId: e.target.value }))}
            >
              <option value="">Cafe…</option>
              {filteredCafes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <label className="text-xs font-medium text-sage-700">
        Brew Method
        <select
          required
          className="mt-1 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
          value={f.brewMethodId ?? ""}
          onChange={(e) => setF((o) => ({ ...o, brewMethodId: e.target.value }))}
        >
          <option value="">…</option>
          {brewMethods.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-sage-700">
        Rating
        <select
          required
          className="mt-1 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
          value={f.rating ?? ""}
          onChange={(e) =>
            setF((o) => ({
              ...o,
              rating: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
        >
          <option value="">Select…</option>
          {ratings.map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-sage-700">
        Notes
        <textarea
          className="mt-1 w-full rounded border border-sage-200 bg-sage-100 px-2 py-1.5 text-sage-900"
          rows={2}
          value={f.notes ?? ""}
          onChange={(e) => setF((o) => ({ ...o, notes: e.target.value }))}
        />
      </label>
      <div className="text-xs text-sage-700">
        Tags
        <div className="mt-1 flex flex-wrap gap-2">
          {tags.map((t) => (
            <label key={t.id} className="inline-flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={f.tagIds?.includes(t.id) ?? false}
                onChange={(e) => {
                  const on = e.target.checked;
                  setF((o) => {
                    const s = new Set(o.tagIds ?? []);
                    if (on) s.add(t.id);
                    else s.delete(t.id);
                    return { ...o, tagIds: [...s] };
                  });
                }}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      <div className="text-xs text-sage-700">
        Visibility:{" "}
        <label className="ml-1">
          <input
            type="radio"
            name="v"
            checked={f.visibility === "public"}
            onChange={() => setF((o) => ({ ...o, visibility: "public" }))}
          />{" "}
          public
        </label>
        <label className="ml-2">
          <input
            type="radio"
            name="v"
            checked={f.visibility === "private"}
            onChange={() => setF((o) => ({ ...o, visibility: "private" }))}
          />{" "}
          private
        </label>
      </div>
      {status && <p className="text-sm text-sage-700">{status}</p>}
      <button
        type="submit"
        className="rounded bg-sage-600 px-4 py-2 text-sm font-medium text-sage-50 hover:bg-sage-700 disabled:hover:bg-sage-600 disabled:opacity-50"
        disabled={busy}
      >
        {busy ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
