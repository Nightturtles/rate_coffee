"use client";

import { MapView } from "@/components/MapView";

export default function MapPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 font-serif text-3xl text-sage-50">Discovery map</h1>
      <p className="mb-4 text-sm text-sage-100">
        US-focused MVP: cafes and roasters with coordinates in your Supabase data. Add venues from your{" "}
        <a className="text-sage-200 underline" href="/log/">
          log
        </a>{" "}
        page, then return here to pan the map.
      </p>
      <MapView />
    </div>
  );
}
