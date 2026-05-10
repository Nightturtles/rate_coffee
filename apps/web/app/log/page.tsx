"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { CheckInForm } from "@/components/CheckInForm";
import { CheckInHistory } from "@/components/CheckInHistory";
import { useAuth } from "@/components/AuthProvider";

export default function LogPage() {
  const { user, loading } = useAuth();
  const [v, setV] = useState(0);
  const bump = useCallback(() => setV((n) => n + 1), []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-serif text-3xl text-foreground">Your log</h1>
      {loading && <p className="text-sm text-muted-foreground">…</p>}
      {!loading && !user && (
        <p className="text-muted-foreground">
          <a className="font-medium text-foreground underline underline-offset-4" href="/login/">
            Log in
          </a>{" "}
          to add coffees and check-ins. Run Supabase migrations (see repository README) first.
        </p>
      )}
      {user && (
        <>
          <CheckInForm
            onCheckIn={() => {
              bump();
            }}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            {"Don't see the coffee, café, or roaster you're looking for? "}
            <Link className="font-medium text-foreground underline underline-offset-4" href="/add">
              Add to the catalog
            </Link>
            .
          </p>
        </>
      )}
      <CheckInHistory version={v} />
    </div>
  );
}
