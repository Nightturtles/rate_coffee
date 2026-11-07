"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  if (state.sent) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-sm text-muted">We sent a sign-in link to <span className="text-text">{state.sent}</span>. Open it on this device to finish signing in.</p>
      </div>
    );
  }
  return (
    <form action={action} className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="block text-sm font-medium">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" autoFocus placeholder="you@example.com"
        className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-accent" />
      {state.error && <p role="alert" className="mt-2 text-sm text-accent">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-4 w-full rounded-full bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="mt-3 text-xs text-muted">No password. The link signs you in and creates an account the first time.</p>
    </form>
  );
}
