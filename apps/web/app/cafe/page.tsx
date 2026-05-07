"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

function CafeBody() {
  const search = useSearchParams();
  const id = search.get("id");
  const [name, setName] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [avg, setAvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !isSupabaseConfigured()) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const { data: c, error: e1 } = await supabase
        .from("cafes")
        .select("name, slug")
        .eq("id", id)
        .maybeSingle();
      if (e1) {
        setErr(e1.message);
        return;
      }
      if (!c) {
        setErr("Not found");
        return;
      }
      setName(c.name);
      const { data: s, error: e2 } = await supabase
        .from("cafe_stats")
        .select("public_check_in_count, public_avg_rating")
        .eq("cafe_id", id)
        .maybeSingle();
      if (e2) {
        setErr(e2.message);
        return;
      }
      if (s) {
        setCount(s.public_check_in_count ?? 0);
        setAvg(
          s.public_avg_rating != null
            ? Number(s.public_avg_rating).toFixed(1)
            : "—"
        );
      }
    })();
  }, [id]);

  if (!isSupabaseConfigured()) {
    return <p>Configure Supabase.</p>;
  }
  if (!id) {
    return <p>Missing <code>id</code> query param.</p>;
  }
  if (err) {
    return <p className="text-red-700">{err}</p>;
  }

  return (
    <div>
      <h1 className="font-serif text-2xl text-sage-50">{name ?? "…"}</h1>
      <p className="mt-2 text-sage-100">
        {count != null && (
          <>
            {count} public check-in{count === 1 ? "" : "s"}
            {avg && avg !== "—" && (
              <> · avg {avg} ★ (public only)</>
            )}
          </>
        )}
      </p>
      <Link className="mt-4 inline-block text-sage-200 underline" href="/map/">
        Back to map
      </Link>
    </div>
  );
}

export default function CafePage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p>…</p>}>
        <CafeBody />
      </Suspense>
    </div>
  );
}
