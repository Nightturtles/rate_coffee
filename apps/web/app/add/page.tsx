"use client";

import Link from "next/link";
import { CatalogAddForm } from "@/components/CatalogAddForm";
import { useAuth } from "@/components/AuthProvider";

export default function AddCatalogPage() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-serif text-3xl text-foreground">Add to catalog</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Add coffees, cafés, and roasters before you log them on{" "}
        <Link className="font-medium text-foreground underline underline-offset-4" href="/log">
          Your log
        </Link>
        .
      </p>
      {loading && <p className="text-sm text-muted-foreground">…</p>}
      {!loading && !user && (
        <p className="text-muted-foreground">
          <a className="font-medium text-foreground underline underline-offset-4" href="/login/">
            Log in
          </a>{" "}
          to add catalog entries. Run Supabase migrations (see repository README) first.
        </p>
      )}
      {user && <CatalogAddForm />}
    </div>
  );
}
