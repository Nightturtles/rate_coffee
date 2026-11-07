"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CheckInState = { error?: string };

const uuid = z.string().uuid();
const optionalUuid = z.preprocess((v) => (v === "" || v == null ? undefined : v), uuid.optional());

const schema = z.object({
  coffee_id: optionalUuid,
  roaster_id: optionalUuid,
  cafe_id: optionalUuid,
  brew_method_id: optionalUuid,
  rating: z.coerce.number().min(0.5).max(5).refine((r) => Number.isInteger(r * 2), "Use half steps"),
  notes: z.string().trim().max(5000).optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  consumed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(uuid).max(10).default([]),
  next: z.string().optional(),
});

export async function createCheckIn(_prev: CheckInState, formData: FormData): Promise<CheckInState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse({ ...raw, tags: formData.getAll("tags") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  if (!v.coffee_id && !v.roaster_id && !v.cafe_id) return { error: "Pick a coffee, roaster, or cafe." };
  if (v.rating < 0.5) return { error: "Give it a rating." };

  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  // Keep the date the user picked, at local-ish noon so time zones don't shift the day.
  const consumed_at = v.consumed_on ? new Date(`${v.consumed_on}T12:00:00`).toISOString() : new Date().toISOString();
  const { data: row, error } = await db
    .from("check_ins")
    .insert({ user_id: user.id, coffee_id: v.coffee_id ?? null, roaster_id: v.roaster_id ?? null, cafe_id: v.cafe_id ?? null, brew_method_id: v.brew_method_id ?? null, rating: v.rating, notes: v.notes || null, visibility: v.visibility, consumed_at })
    .select("id, roaster_id")
    .single();
  if (error || !row) return { error: error?.message ?? "Couldn't save." };

  if (v.tags.length) {
    const { error: tagErr } = await db.from("check_in_tags").insert(v.tags.map((tag_id) => ({ check_in_id: row.id, tag_id })));
    if (tagErr) return { error: `Saved, but tags failed: ${tagErr.message}` };
  }

  // A check-in at a cafe is evidence that the cafe serves that roaster.
  if (v.cafe_id && row.roaster_id) {
    const { data: existing } = await db.from("cafe_roasters").select("cafe_id").eq("cafe_id", v.cafe_id).eq("roaster_id", row.roaster_id).maybeSingle();
    if (!existing) {
      await db.from("cafe_roasters").insert({ cafe_id: v.cafe_id, roaster_id: row.roaster_id, relationship: "serves", source: "user_checkin", confidence: 0.6, created_by: user.id });
    }
  }

  redirect(safeNext(v.next, "/me"));
}
