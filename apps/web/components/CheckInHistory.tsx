"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tagsByCheckInFromRows } from "@/lib/checkInTagMap";
import { feedCardClass, tagPillClass } from "@/lib/form-classes";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { RatingCups } from "./RatingCups";

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
  const [cafeNames, setCafeNames] = useState<Record<string, string>>({});
  const [brewLabels, setBrewLabels] = useState<Record<string, string>>({});
  const [tagsByCheckIn, setTagsByCheckIn] = useState<Record<string, string[]>>({});
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
    const list = (data as Row[]) ?? [];
    setRows(list);

    if (list.length === 0) {
      setNames({});
      setCafeNames({});
      setBrewLabels({});
      setTagsByCheckIn({});
      return;
    }

    const coffeeIds = [...new Set(list.map((d) => d.coffee_id))];
    const checkInIds = list.map((d) => d.id);
    const cafeIds = [...new Set(list.map((d) => d.cafe_id).filter(Boolean))] as string[];
    const brewIds = [...new Set(list.map((d) => d.brew_method_id))];

    const [
      { data: cs },
      { data: cafes },
      { data: brewMethods },
      { data: tagJoinRows },
    ] = await Promise.all([
      coffeeIds.length
        ? supabase
            .from("coffees")
            .select("id, name, roaster:roasters!roaster_id (name)")
            .in("id", coffeeIds)
        : Promise.resolve({ data: [] }),
      cafeIds.length
        ? supabase.from("cafes").select("id, name").in("id", cafeIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      brewIds.length
        ? supabase.from("brew_methods").select("id, label").in("id", brewIds)
        : Promise.resolve({ data: [] as { id: string; label: string }[] }),
      checkInIds.length
        ? supabase.from("check_in_tags").select("check_in_id, tags(label)").in("check_in_id", checkInIds)
        : Promise.resolve({
            data: [] as {
              check_in_id: string;
              tags: { label: string } | { label: string }[] | null;
            }[],
          }),
    ]);

    const m: Record<string, string> = {};
    for (const c of cs ?? []) {
      const r = c as { id: string; name: string; roaster: { name: string } | { name: string }[] | null };
      const rn = Array.isArray(r.roaster) ? r.roaster[0]?.name : r.roaster?.name;
      m[r.id] = `${r.name} — ${rn ?? "?"}`;
    }
    setNames(m);

    const cafeMap: Record<string, string> = {};
    for (const c of cafes ?? []) {
      cafeMap[c.id] = c.name;
    }
    setCafeNames(cafeMap);

    const brewMap: Record<string, string> = {};
    for (const b of brewMethods ?? []) {
      brewMap[b.id] = b.label;
    }
    setBrewLabels(brewMap);

    setTagsByCheckIn(tagsByCheckInFromRows(tagJoinRows ?? []));
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load, version]);

  if (!user) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 font-serif text-lg text-foreground">Your recent check-ins</h2>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No check-ins yet. Add a roaster, coffee, then log above.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className={feedCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-foreground">
                {names[r.coffee_id] ?? r.coffee_id}
              </span>
              <RatingCups rating={Number(r.rating)} />
            </div>
            {brewLabels[r.brew_method_id] && (
              <div className="mt-1 text-xs text-muted-foreground">
                Brew: {brewLabels[r.brew_method_id]}
              </div>
            )}
            {r.context === "cafe" && r.cafe_id && cafeNames[r.cafe_id] && (
              <div className="mt-0.5 text-xs text-muted-foreground">At {cafeNames[r.cafe_id]}</div>
            )}
            <div className="mt-1 text-xs text-muted-foreground/90">
              {r.context} · {r.visibility} · {new Date(r.created_at).toLocaleString()}
            </div>
            {(tagsByCheckIn[r.id]?.length ?? 0) > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {tagsByCheckIn[r.id]!.map((t) => (
                  <span key={t} className={tagPillClass}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {r.notes && <p className="mt-1 text-foreground">{r.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
