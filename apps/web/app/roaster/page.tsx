"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

function RoasterBody() {
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
      const { data: r, error: e1 } = await supabase
        .from("roasters")
        .select("name, slug")
        .eq("id", id)
        .maybeSingle();
      if (e1) {
        setErr(e1.message);
        return;
      }
      if (!r) {
        setErr("Not found");
        return;
      }
      setName(r.name);
      const { data: s, error: e2 } = await supabase
        .from("roaster_stats")
        .select("public_check_in_count, public_avg_rating")
        .eq("roaster_id", id)
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
    return <p className="text-destructive">{err}</p>;
  }

  return (
    <div>
      <h1 className="font-serif text-2xl text-foreground">{name ?? "…"}</h1>
      <p className="mt-2 text-muted-foreground">
        {count != null && (
          <>
            {count} public check-in{count === 1 ? "" : "s"}
            {avg && avg !== "—" && (
              <> · avg {avg} ★ (public only)</>
            )}
          </>
        )}
      </p>
      <Link className="mt-4 inline-block font-medium text-foreground underline underline-offset-4" href="/map/">
        Back to map
      </Link>
    </div>
  );
}

export default function RoasterPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p className="text-muted-foreground">…</p>}>
        <RoasterBody />
      </Suspense>
    </div>
  );
}
