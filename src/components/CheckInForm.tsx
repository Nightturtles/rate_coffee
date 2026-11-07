"use client";

import { useActionState, useState } from "react";
import { createCheckIn, type CheckInState } from "@/app/log/actions";
import { RatingCups } from "./RatingCups";

export type Option = { id: string; label: string; group?: string };

type Props = {
  roaster?: { id: string; name: string } | null;
  cafe?: { id: string; name: string } | null;
  coffees: Option[];
  roasterOptions: Option[];
  brewMethods: Option[];
  tags: Option[];
  initialCoffeeId?: string;
  next: string;
};

const field = "mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent";
const label = "block text-sm font-medium";

export function CheckInForm({ roaster, cafe, coffees, roasterOptions, brewMethods, tags, initialCoffeeId, next }: Props) {
  const [state, action, pending] = useActionState<CheckInState, FormData>(createCheckIn, {});
  const [rating, setRating] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().slice(0, 10);
  const groups = [...new Set(brewMethods.map((b) => b.group))];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {cafe && <input type="hidden" name="cafe_id" value={cafe.id} />}

      {roaster ? (
        <input type="hidden" name="roaster_id" value={roaster.id} />
      ) : (
        <div>
          <label htmlFor="roaster_id" className={label}>Roaster</label>
          <select id="roaster_id" name="roaster_id" className={field} defaultValue="">
            <option value="">Not sure</option>
            {roasterOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {cafe && roasterOptions.length === 0 && <p className="mt-1 text-xs text-muted">We don&apos;t know who this cafe pours yet. Your check-in still counts for the cafe.</p>}
        </div>
      )}

      {coffees.length > 0 && (
        <div>
          <label htmlFor="coffee_id" className={label}>Coffee</label>
          <select id="coffee_id" name="coffee_id" className={field} defaultValue={initialCoffeeId ?? ""}>
            <option value="">Not listed / don&apos;t know</option>
            {coffees.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      )}

      <div>
        <span className={label}>Rating</span>
        <div className="mt-1"><RatingCups value={rating} onChange={setRating} name="rating" size={34} /></div>
      </div>

      <div>
        <label htmlFor="brew_method_id" className={label}>How was it brewed?</label>
        <select id="brew_method_id" name="brew_method_id" className={field} defaultValue="">
          <option value="">Skip</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {brewMethods.filter((b) => b.group === g).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <span className={label}>Tasting notes</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const on = picked.has(t.id);
            return (
              <label key={t.id} className={`cursor-pointer select-none rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted hover:bg-surface-2"}`}>
                <input type="checkbox" name="tags" value={t.id} checked={on} className="sr-only"
                  onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />
                {t.label}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={label}>Notes</label>
        <textarea id="notes" name="notes" rows={3} maxLength={5000} placeholder="What stood out?" className={field} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="consumed_on" className={label}>When</label>
          <input id="consumed_on" name="consumed_on" type="date" defaultValue={today} max={today} className={field} />
        </div>
        <div>
          <label htmlFor="visibility" className={label}>Visibility</label>
          <select id="visibility" name="visibility" className={field} defaultValue="public">
            <option value="public">Public</option>
            <option value="private">Only me</option>
          </select>
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-accent">{state.error}</p>}
      <button type="submit" disabled={pending || rating == null} className="w-full rounded-full bg-accent px-4 py-2.5 font-medium text-accent-fg disabled:opacity-50">
        {pending ? "Saving…" : "Save check-in"}
      </button>
    </form>
  );
}
