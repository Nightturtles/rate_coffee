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

export function CheckInForm({ onCheckIn }: Props) {
  const { user } = useAuth();
  const [brewMethods, setBrewMethods] = useState<Option[]>([]);
  const [tags, setTags] = useState<Option[]>([]);
  const [coffees, setCoffees] = useState<{ id: string; label: string }[]>([]);
  const [cafes, setCafes] = useState<Option[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Partial<CheckInFormValues>>({
    context: "home",
    tagIds: [],
    visibility: "public",
    rating: 3,
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
    const [bm, tg, co, ca] = await Promise.all([
      supabase.from("brew_methods").select("id, label, sort_order").order("sort_order", { ascending: true }),
      supabase.from("tags").select("id, label, sort_order").order("sort_order", { ascending: true }),
      supabase
        .from("coffees")
        .select("id, name, roaster:roasters!roaster_id ( name )")
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
    if (co.data) {
      setCoffees(
        co.data.map((r) => {
          const row = r as { id: string; name: string; roaster: { name: string } | { name: string }[] | null };
          const rn = Array.isArray(row.roaster) ? row.roaster[0]?.name : row.roaster?.name;
          return { id: row.id, label: `${row.name} — ${rn ?? "roaster"}` };
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

  if (!user) {
    return (
      <p className="text-sm text-amber-800/80">
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
    setStatus("Saved");
    onCheckIn();
    setBusy(false);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 rounded-lg border border-amber-900/15 bg-white/60 p-4">
      <h2 className="font-serif text-lg text-amber-950">New check-in</h2>
      <label className="text-xs font-medium text-amber-800/80">
        Coffee
        <select
          required
          className="mt-1 w-full rounded border border-amber-900/20 bg-white px-2 py-1.5"
          value={f.coffeeId ?? ""}
          onChange={(e) => setF((o) => ({ ...o, coffeeId: e.target.value }))}
        >
          <option value="">Select…</option>
          {coffees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="text-xs font-medium text-amber-800/80">
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
          <select
            className="mt-2 w-full rounded border border-amber-900/20 bg-white px-2 py-1.5"
            required
            value={f.cafeId ?? ""}
            onChange={(e) => setF((o) => ({ ...o, cafeId: e.target.value }))}
          >
            <option value="">Cafe…</option>
            {cafes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <label className="text-xs font-medium text-amber-800/80">
        Brew
        <select
          required
          className="mt-1 w-full rounded border border-amber-900/20 bg-white px-2 py-1.5"
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
      <label className="text-xs font-medium text-amber-800/80">
        Rating
        <select
          required
          className="mt-1 w-full rounded border border-amber-900/20 bg-white px-2 py-1.5"
          value={f.rating ?? 3}
          onChange={(e) => setF((o) => ({ ...o, rating: Number(e.target.value) }))}
        >
          {ratings.map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-amber-800/80">
        Notes
        <textarea
          className="mt-1 w-full rounded border border-amber-900/20 bg-white px-2 py-1.5"
          rows={2}
          value={f.notes ?? ""}
          onChange={(e) => setF((o) => ({ ...o, notes: e.target.value }))}
        />
      </label>
      <div className="text-xs text-amber-800/80">
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
      <div className="text-xs text-amber-800/80">
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
      {status && <p className="text-sm text-amber-900/90">{status}</p>}
      <button
        type="submit"
        className="rounded bg-amber-900 px-4 py-2 text-sm font-medium text-amber-50 disabled:opacity-50"
        disabled={busy}
      >
        {busy ? "Saving…" : "Log check-in"}
      </button>
    </form>
  );
}
