"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

type Props = {
  checkInId: string;
  count: number;
  cheered: boolean;
  onChange: (checkInId: string, nextCheered: boolean) => void;
};

export function CheersButton({ checkInId, count, cheered, onChange }: Props) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  const supabase = useMemo(
    () =>
      typeof window !== "undefined" && isSupabaseConfigured()
        ? getSupabaseBrowserClient()
        : null,
    []
  );

  const baseClasses =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors";

  if (!user) {
    return (
      <Link
        href="/login"
        className={`${baseClasses} border border-border bg-muted text-foreground hover:bg-muted/80`}
        aria-label="Log in to cheers"
      >
        <span aria-hidden>👏</span>
        <span>Cheers</span>
        <span className="text-muted-foreground">· {count}</span>
      </Link>
    );
  }

  async function toggle() {
    if (!supabase || !user || pending) return;
    setPending(true);
    const next = !cheered;
    onChange(checkInId, next);
    try {
      if (next) {
        const { error } = await supabase
          .from("check_in_cheers")
          .insert({ check_in_id: checkInId, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("check_in_cheers")
          .delete()
          .eq("check_in_id", checkInId)
          .eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      onChange(checkInId, !next);
    } finally {
      setPending(false);
    }
  }

  const cheeredClasses = cheered
    ? "border border-primary bg-primary text-primary-foreground hover:bg-primary/90"
    : "border border-border bg-card text-foreground hover:bg-muted";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      aria-pressed={cheered}
      className={`${baseClasses} ${cheeredClasses} disabled:opacity-60`}
    >
      <span aria-hidden>👏</span>
      <span>{cheered ? "Cheered" : "Cheers"}</span>
      <span className={cheered ? "text-primary-foreground/90" : "text-muted-foreground"}>
        · {count}
      </span>
    </button>
  );
}
