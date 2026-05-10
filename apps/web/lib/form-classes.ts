/** Shared control + surface styles (semantic tokens / dark chrome). */

/** Inset fields: darker fill than `bg-card` so borders read; placeholder uses mid sage from theme */
export const inputClass =
  "rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-foreground/15 placeholder:text-sage-400 transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0";

export const selectClass = inputClass;

export const textareaClass = `${inputClass} min-h-[4rem]`;

export const cardSurfaceClass =
  "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm ring-1 ring-foreground/10";

/** Dense cards for feed / history rows */
export const feedCardClass =
  "rounded-xl border border-border bg-card p-3 text-sm text-card-foreground shadow-sm ring-1 ring-foreground/10";

export const tagPillClass =
  "rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground";

export function tabButtonClass(active: boolean) {
  return active
    ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
    : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
}

/** Same shell as `inputClass` / native `<select>` so combobox lists match Brew Method–style fields */
export const comboboxListClass =
  "absolute z-20 mt-0.5 max-h-48 w-full overflow-auto rounded-md border border-input bg-background py-1 text-foreground shadow-[0_8px_28px_rgba(0,0,0,0.45)]";

/** Neutral rows (foreground tint), aligned with OS-like gray hover on dark menus — not primary/sage */
export const comboboxOptionClass =
  "w-full rounded-sm px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-foreground/12 hover:text-foreground";

export const comboboxOptionActiveClass = "bg-foreground/18 text-foreground";
