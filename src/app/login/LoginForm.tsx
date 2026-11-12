"use client";

import { useActionState, useState } from "react";
import { btn, btnOutline, field, fieldLabel } from "@/lib/ui";
import { sendMagicLink, signInWithGoogle, verifyCode, type LoginState } from "./actions";

export function LoginForm({ next, google }: { next: string; google: boolean }) {
  const [sendState, sendAction, sending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const [codeState, codeAction, verifying] = useActionState<LoginState, FormData>(verifyCode, {});
  const [startOver, setStartOver] = useState<string | null>(null);
  const email = sendState.sent && startOver !== sendState.sent ? sendState.sent : null;

  if (email) {
    return (
      <form action={codeAction} className="border-t border-border pt-5">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={email} />
        <p className="label">Check your email</p>
        <p className="mt-3 leading-relaxed text-muted">
          We sent a code to <span className="text-text">{email}</span>. Enter it here, or open the link in the email on this device.
        </p>
        <label htmlFor="token" className={`${fieldLabel} mt-6`}>Code from the email</label>
        <input
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          required
          autoFocus
          className={`${field} num text-center text-2xl tracking-[0.4em]`}
        />
        {codeState.error && <p role="alert" className="mt-3 text-sm text-bronze">{codeState.error}</p>}
        <button type="submit" disabled={verifying} className={`${btn} mt-5 w-full`}>
          {verifying ? "Checking…" : "Sign in"}
        </button>
        <button type="button" onClick={() => setStartOver(email)} className="label mt-5 block text-text transition hover:text-muted">
          Send a new code
        </button>
      </form>
    );
  }

  return (
    <div className="border-t border-border pt-5">
      {google && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button type="submit" className={`${btnOutline} w-full`}>Continue with Google</button>
          </form>
          <p className="label my-5 text-center">or</p>
        </>
      )}
      <form action={sendAction}>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="email" className={fieldLabel}>Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" autoFocus={!google} placeholder="you@example.com" className={field} />
        {sendState.error && <p role="alert" className="mt-3 text-sm text-bronze">{sendState.error}</p>}
        <button type="submit" disabled={sending} className={`${btn} mt-5 w-full`}>
          {sending ? "Sending…" : "Email me a code"}
        </button>
        <p className="mt-4 text-xs leading-relaxed text-muted">No password. The code signs you in and creates an account the first time.</p>
      </form>
    </div>
  );
}
