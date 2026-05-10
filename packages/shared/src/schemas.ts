import { z } from "zod";

export const RATING_MIN = 0.5;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;
export const DEFAULT_REGION = "US";

const halfStar = z
  .number()
  .min(RATING_MIN)
  .max(RATING_MAX)
  .refine(
    (n) => Math.abs(n * 2 - Math.round(n * 2)) < 1e-6,
    "Must be a multiple of 0.5"
  );

export const checkInFormSchema = z
  .object({
    coffeeId: z.string().uuid(),
    cafeId: z.string().uuid().nullable().optional(),
    context: z.enum(["home", "cafe"]),
    brewMethodId: z.string().uuid(),
    rating: halfStar,
    notes: z.string().max(5000).optional().default(""),
    tagIds: z.array(z.string().uuid()).default([]),
    visibility: z.enum(["public", "private"]).default("public"),
  })
  .superRefine((v, ctx) => {
    if (v.context === "cafe" && !v.cafeId) {
      ctx.addIssue({ code: "custom", message: "Cafe is required for cafe check-ins" });
    }
    if (v.context === "home" && v.cafeId) {
      ctx.addIssue({ code: "custom", message: "Cafe should be empty for home check-ins" });
    }
  });

export type CheckInFormValues = z.infer<typeof checkInFormSchema>;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";

/** Matches `public.normalize_entity_name` in Postgres (trim, lower, collapse whitespace). */
export const normalizeEntityName = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, " ");
