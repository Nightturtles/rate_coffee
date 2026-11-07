"use client";

import { useActionState } from "react";
import { btn, field, fieldLabel } from "@/lib/ui";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  if (state.sent) {
    return (
      <div className="border-t border-border pt-5">
        <p className="label">Check your email</p>
        <p className="mt-3 leading-relaxed text-muted">We sent a sign-in link to <span className="text-text">{state.sent}</span>. Open it on this device to finish signing in.</p>
      </div>
    );
  }
  return (
    <form action={action} className="border-t border-border pt-5">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className={fieldLabel}>Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" autoFocus placeholder="you@example.com" className={field} />
      {state.error && <p role="alert" className="mt-3 text-sm text-bronze">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btn} mt-5 w-full`}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="mt-4 text-xs leading-relaxed text-muted">No password. The link signs you in and creates an account the first time.</p>
    </form>
  );
}
