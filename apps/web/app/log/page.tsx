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
      <h1 className="mb-2 font-serif text-3xl text-slate-800 dark:text-slate-50">Your log</h1>
      {loading && <p className="text-sm text-slate-500">…</p>}
      {!loading && !user && (
        <p className="text-slate-600 dark:text-slate-300">
          <a className="font-medium text-blue-700 underline dark:text-blue-400" href="/login/">
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
