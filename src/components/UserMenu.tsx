import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

/** Header slot: sign-in link, or the user's name with a sign-out button. Async, so wrap in Suspense. */
export async function UserMenu() {
  const user = await getSessionUser();
  if (!user) {
    return <Link href="/login" className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2">Sign in</Link>;
  }
  return (
    <div className="flex items-center gap-1">
      <Link href="/me" className="max-w-[9rem] truncate rounded-full px-3 py-1.5 text-sm hover:bg-surface-2">{user.displayName}</Link>
      <form action={signOut}>
        <button type="submit" className="rounded-full px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text">Sign out</button>
      </form>
    </div>
  );
}
