"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

type Row = {
  id: string;
  created_at: string;
  rating: string | number;
  notes: string | null;
  context: string;
  visibility: string;
  coffee_id: string;
  brew_method_id: string;
  cafe_id: string | null;
};

type Props = { version: number };

export function CheckInHistory({ version }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const supabase = useMemo(
    () =>
      typeof window !== "undefined" && isSupabaseConfigured()
        ? getSupabaseBrowserClient()
        : null,
    []
  );

  const load = useCallback(async () => {
    if (!user || !supabase) {
      setRows([]);
      return;
    }
    const { data, error } = await supabase
      .from("check_ins")
      .select("id, created_at, rating, notes, context, visibility, coffee_id, brew_method_id, cafe_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setRows((data as Row[]) ?? []);
    const ids = [...new Set((data as Row[]).map((d) => d.coffee_id))];
    if (ids.length) {
      const { data: cs } = await supabase
        .from("coffees")
        .select("id, name, roaster:roasters!roaster_id (name)")
        .in("id", ids);
      const m: Record<string, string> = {};
      for (const c of cs ?? []) {
        const r = c as { id: string; name: string; roaster: { name: string } | { name: string }[] | null };
        const rn = Array.isArray(r.roaster) ? r.roaster[0]?.name : r.roaster?.name;
        m[r.id] = `${r.name} — ${rn ?? "?"}`;
      }
      setNames(m);
    }
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load, version]);

  if (!user) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 font-serif text-lg text-slate-800 dark:text-slate-50">Recent check-ins</h2>
      {rows.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">No check-ins yet. Add a roaster, coffee, then log above.</p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/50"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-50">
                {names[r.coffee_id] ?? r.coffee_id}
              </span>
              <span className="text-slate-600 dark:text-slate-300">{r.rating} ★</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {r.context} · {r.visibility} · {new Date(r.created_at).toLocaleString()}
            </div>
            {r.notes && <p className="mt-1 text-slate-800 dark:text-slate-200">{r.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
