export type RoasterSeed = {
  name: string;
  website: string;
  city: string;
  state?: string;
  country_code?: string;
  instagram?: string | null;
  /** Override the shop origin when the store lives on a different domain. */
  shop_url?: string | null;
  curation_tier?: number;
  notes?: string | null;
};

export type RawProduct = {
  external_id: string;
  title: string;
  handle: string;
  url: string;
  product_type: string;
  tags: string[];
  body_text: string;
  image_url: string | null;
  price_cents: number | null;
  size_grams: number | null;
  available: boolean;
  published_at: string | null;
};

export type RoastLevel = "ultra_light" | "light" | "medium_light" | "medium" | "medium_dark" | "dark";
export type ProcessFamily = "washed" | "natural" | "honey" | "anaerobic" | "experimental" | "other";
export type ProcessFocus = "washed" | "mixed" | "experimental";

export type CoffeeRecord = {
  external_id: string;
  name: string;
  slug: string;
  url: string;
  image_url: string | null;
  price_cents: number | null;
  size_grams: number | null;
  is_blend: boolean;
  roast_level: RoastLevel | null;
  origin_country_code: string | null;
  origin_region: string | null;
  producer: string | null;
  varieties: string[];
  process: string | null;
  process_family: ProcessFamily | null;
  tasting_notes: string[];
  status: "active" | "closed";
};

export type RoasterAttributes = {
  roast_level: RoastLevel | null;
  process_focus: ProcessFocus | null;
  single_origin_share: number | null;
  coffee_count: number;
  description: string | null;
};
