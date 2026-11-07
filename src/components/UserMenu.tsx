import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

/** Header slot: sign-in link, or the user's name with a sign-out button. Async, so wrap in Suspense. */
export async function UserMenu() {
  const user = await getSessionUser();
  if (!user) {
    return <Link href="/login" className="label whitespace-nowrap text-text transition hover:text-muted">Sign in</Link>;
  }
  return (
    <div className="flex items-center gap-4">
      <Link href="/me" className="label max-w-[9rem] truncate text-text transition hover:text-muted">{user.displayName}</Link>
      <form action={signOut}>
        <button type="submit" className="label transition hover:text-text">Sign out</button>
      </form>
    </div>
  );
}
