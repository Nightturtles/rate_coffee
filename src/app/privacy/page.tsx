import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Filtered stores about you, who else handles it, and how to remove it.",
};

const CONTACT = "hello@filtered.cafe";
const UPDATED = "November 11, 2026";

const h2 = "label mt-14 border-b border-border pb-3";
const p = "mt-4 leading-relaxed";
const li = "border-b border-border py-3 leading-relaxed";
const a = "underline decoration-border underline-offset-4 transition hover:decoration-text";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-14">
      <p className="label">Privacy</p>
      <h1 className="mt-3 text-4xl font-light tracking-tight">What we keep, and why</h1>
      <p className="mt-4 text-muted">
        Filtered is a guide to specialty coffee roasters and the cafes that serve them. You can browse all of it without an account.
        This page covers what happens when you make one. Last updated {UPDATED}.
      </p>

      <h2 className={h2}>What we store</h2>
      <ul className="mt-1">
        <li className={li}>
          <span className="font-medium">Your email address.</span> It is how you sign in. We send sign-in codes to it and nothing else.
        </li>
        <li className={li}>
          <span className="font-medium">A display name and picture, if you use Google.</span> Google shares your name, email address and
          profile picture when you choose Continue with Google. We keep the name and the picture link so your check-ins can carry a name.
          We never see your Google password, contacts or anything else in your Google account.
        </li>
        <li className={li}>
          <span className="font-medium">Your check-ins.</span> The coffee, roaster or cafe, your rating, brew method, flavor tags, any
          notes you write, and when you logged it.
        </li>
      </ul>

      <h2 className={h2}>What other people can see</h2>
      <p className={p}>
        A check-in marked Public appears on the roaster and cafe pages with your display name, and its rating counts toward their
        scores. A check-in marked Private is visible only to you. Your email address is never shown to anyone.
      </p>

      <h2 className={h2}>Location</h2>
      <p className={p}>
        We only read your location when you press My location. The coordinates are sent with the page request so we can sort places by
        distance, and your browser remembers the last place you picked. Your location is not saved to your account.
      </p>

      <h2 className={h2}>Cookies and tracking</h2>
      <p className={p}>
        We set the cookies that keep you signed in. There is no advertising, no analytics script and no cross-site tracking. We do
        not sell or rent your data, and we do not share it for marketing.
      </p>

      <h2 className={h2}>Who else handles your data</h2>
      <ul className="mt-1">
        <li className={li}><span className="font-medium">Supabase</span> hosts the database and runs sign-in.</li>
        <li className={li}><span className="font-medium">Vercel</span> serves the site and keeps short-lived request logs.</li>
        <li className={li}><span className="font-medium">Google</span> is involved only if you sign in with Google.</li>
        <li className={li}><span className="font-medium">CARTO</span> supplies the map tiles on the map page.</li>
        <li className={li}>
          <span className="font-medium">Roasters and cafes.</span> Their logos and photos load straight from their own websites, so
          those sites receive the same request any visitor to them would send.
        </li>
      </ul>

      <h2 className={h2}>Removing your data</h2>
      <p className={p}>
        Email <a className={a} href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you signed up with and we will delete your
        account and every check-in attached to it. You can ask for a copy of your data the same way.
      </p>

      <h2 className={h2}>Changes and contact</h2>
      <p className={p}>
        If this page changes in a way that matters, the date above changes with it. Questions go to{" "}
        <a className={a} href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <p className="mt-14"><Link href="/" className="label transition hover:text-text">← Back to Filtered</Link></p>
    </main>
  );
}
