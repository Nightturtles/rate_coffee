"use client";

import { useState, useCallback } from "react";
import { CheckInForm } from "@/components/CheckInForm";
import { CheckInHistory } from "@/components/CheckInHistory";
import { EntityCreatePanel } from "@/components/EntityCreatePanel";
import { useAuth } from "@/components/AuthProvider";

export default function LogPage() {
  const { user, loading } = useAuth();
  const [v, setV] = useState(0);
  const bump = useCallback(() => setV((n) => n + 1), []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-serif text-3xl text-amber-950">Your log</h1>
      {loading && <p className="text-sm text-amber-800/60">…</p>}
      {!loading && !user && (
        <p className="text-amber-800/80">
          <a className="font-medium text-amber-900 underline" href="/login/">
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
          <EntityCreatePanel
            onChanged={() => {
              bump();
            }}
          />
        </>
      )}
      <CheckInHistory version={v} />
    </div>
  );
}
