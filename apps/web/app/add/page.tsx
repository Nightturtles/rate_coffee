"use client";

import Link from "next/link";
import { CatalogAddForm } from "@/components/CatalogAddForm";
import { useAuth } from "@/components/AuthProvider";

export default function AddCatalogPage() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-serif text-3xl text-sage-50">Add to catalog</h1>
      <p className="mb-6 text-sm text-sage-200">
        Add coffees, cafés, and roasters before you log them on{" "}
        <Link className="font-medium text-sage-100 underline" href="/log">
          Your log
        </Link>
        .
      </p>
      {loading && <p className="text-sm text-sage-200">…</p>}
      {!loading && !user && (
        <p className="text-sage-100">
          <a className="font-medium text-sage-200 underline" href="/login/">
            Log in
          </a>{" "}
          to add catalog entries. Run Supabase migrations (see repository README) first.
        </p>
      )}
      {user && <CatalogAddForm />}
    </div>
  );
}
