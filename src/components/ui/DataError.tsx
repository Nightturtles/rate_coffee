/** Inline notice for a failed data section, so one bad query never blanks the page. */
export function DataError({ error, what }: { error: unknown; what: string }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <p role="alert" className="mt-4 border border-border p-4 text-sm text-muted">
      Couldn&apos;t load {what}. <span className="font-mono text-xs">{msg}</span>
    </p>
  );
}
