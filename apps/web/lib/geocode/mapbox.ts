export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
  rawFeature: Record<string, unknown>;
};

export function isMapboxGeocodeConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim());
}

/**
 * Forward geocode via Mapbox Geocoding API (browser-safe token with URL restrictions).
 */
export async function forwardGeocode(query: string): Promise<GeocodeResult[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set.");
  }
  const q = query.trim();
  if (!q) {
    throw new Error("Enter an address to search.");
  }

  const path = encodeURIComponent(q);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?limit=5&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      body ? `Geocoding failed (${res.status}): ${body.slice(0, 200)}` : `Geocoding failed (${res.status}).`
    );
  }

  const data = (await res.json()) as {
    features?: Array<{
      place_name?: string;
      center?: [number, number];
      properties?: Record<string, unknown>;
      geometry?: Record<string, unknown>;
      [key: string]: unknown;
    }>;
  };

  const features = data.features ?? [];
  const out: GeocodeResult[] = [];
  for (const f of features) {
    const center = f.center;
    if (!center || center.length < 2) continue;
    const [lng, lat] = center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const label =
      typeof f.place_name === "string" && f.place_name.trim()
        ? f.place_name.trim()
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const rawFeature = f as Record<string, unknown>;
    out.push({ lat, lng, label, rawFeature });
  }
  if (out.length === 0) {
    throw new Error("No matching locations found. Try a fuller street address.");
  }
  return out;
}

export function mapboxAddressJson(result: GeocodeResult): Record<string, unknown> {
  return {
    provider: "mapbox",
    label: result.label,
    lat: result.lat,
    lng: result.lng,
    feature: result.rawFeature,
  };
}
