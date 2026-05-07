"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { CheersButton } from "./CheersButton";
import {
  aggregateCheers,
  applyRemoteCheer,
  toggleMyCheer,
  type CheerRow,
  type CheersMap,
} from "./cheersState";

type Row = {
  id: string;
  created_at: string;
  rating: string | number;
  notes: string | null;
  context: string;
  coffee_id: string;
  cafe_id: string | null;
  user_id: string;
};

const PAGE_SIZE = 50;

export function ActivityFeed() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [coffeeNames, setCoffeeNames] = useState<Record<string, string>>({});
  const [posterNames, setPosterNames] = useState<Record<string, string>>({});
  const [cheers, setCheers] = useState<CheersMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set of check-in IDs currently rendered. Realtime events for any other
  // check-in are ignored so we don't drift away from the visible feed.
  const visibleIdsRef = useRef<Set<string>>(new Set());

  const supabase = useMemo(
    () =>
      typeof window !== "undefined" && isSupabaseConfigured()
        ? getSupabaseBrowserClient()
        : null,
    []
  );

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError("Supabase is not configured.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: feedErr } = await supabase
      .from("check_ins")
      .select("id, created_at, rating, notes, context, coffee_id, cafe_id, user_id")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (feedErr) {
      console.error(feedErr);
      setError("Could not load activity.");
      setLoading(false);
      return;
    }

    const list = (data as Row[]) ?? [];
    setRows(list);
    visibleIdsRef.current = new Set(list.map((r) => r.id));

    if (list.length === 0) {
      setCoffeeNames({});
      setPosterNames({});
      setCheers({});
      setLoading(false);
      return;
    }

    const coffeeIds = [...new Set(list.map((r) => r.coffee_id))];
    const userIds = [...new Set(list.map((r) => r.user_id))];
    const checkInIds = list.map((r) => r.id);

    const [{ data: coffees }, { data: profiles }, { data: cheerRows }] = await Promise.all([
      supabase
        .from("coffees")
        .select("id, name, roaster:roasters!roaster_id (name)")
        .in("id", coffeeIds),
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds),
      supabase
        .from("check_in_cheers")
        .select("check_in_id, user_id")
        .in("check_in_id", checkInIds),
    ]);

    const cMap: Record<string, string> = {};
    for (const c of coffees ?? []) {
      const r = c as {
        id: string;
        name: string;
        roaster: { name: string } | { name: string }[] | null;
      };
      const rn = Array.isArray(r.roaster) ? r.roaster[0]?.name : r.roaster?.name;
      cMap[r.id] = `${r.name} — ${rn ?? "?"}`;
    }
    setCoffeeNames(cMap);

    const pMap: Record<string, string> = {};
    for (const p of profiles ?? []) {
      const r = p as { id: string; display_name: string | null };
      if (r.display_name) pMap[r.id] = r.display_name;
    }
    setPosterNames(pMap);

    setCheers(aggregateCheers(checkInIds, (cheerRows ?? []) as CheerRow[], user?.id ?? null));
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: when anyone (else) cheers or un-cheers a visible check-in,
  // adjust its count locally. We skip events from the current user because
  // the optimistic update in onCheersChange already accounts for them.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("check_in_cheers_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "check_in_cheers" },
        (payload) => {
          const row = payload.new as { check_in_id: string; user_id: string };
          setCheers((prev) =>
            applyRemoteCheer(
              prev,
              { type: "INSERT", checkInId: row.check_in_id, userId: row.user_id },
              user?.id ?? null,
              visibleIdsRef.current
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "check_in_cheers" },
        (payload) => {
          const row = payload.old as { check_in_id?: string; user_id?: string };
          if (!row.check_in_id || !row.user_id) return;
          setCheers((prev) =>
            applyRemoteCheer(
              prev,
              { type: "DELETE", checkInId: row.check_in_id!, userId: row.user_id! },
              user?.id ?? null,
              visibleIdsRef.current
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  const onCheersChange = useCallback((checkInId: string, nextCheered: boolean) => {
    setCheers((prev) => toggleMyCheer(prev, checkInId, nextCheered));
  }, []);

  if (loading) {
    return <p className="text-sm text-sage-200">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-sage-200">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-sage-100">
        No public check-ins yet. Be the first — add one from{" "}
        <a className="font-medium text-sage-50 underline" href="/log/">
          your log
        </a>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const ch = cheers[r.id] ?? { count: 0, mine: false };
        const poster = posterNames[r.user_id] ?? "Someone";
        return (
          <li
            key={r.id}
            className="rounded border border-sage-200 bg-sage-50 p-3 text-sm text-sage-900 shadow-lg"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-sage-900">
                {coffeeNames[r.coffee_id] ?? r.coffee_id}
              </span>
              <span className="text-sage-700">{r.rating} ★</span>
            </div>
            <div className="mt-1 text-xs text-sage-400">
              {poster} · {r.context} · {new Date(r.created_at).toLocaleString()}
            </div>
            {r.notes && <p className="mt-1 text-sage-900">{r.notes}</p>}
            <div className="mt-2">
              <CheersButton
                checkInId={r.id}
                count={ch.count}
                cheered={ch.mine}
                onChange={onCheersChange}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
