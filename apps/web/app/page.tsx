import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-300">MVP</p>
      <h1 className="mt-1 font-serif text-4xl text-slate-800 dark:text-slate-50">Track & rate coffee</h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-200">
        Log what you drink (home or cafe), add roasters and coffees, and explore a map of
        roasters and cafes — without selling beans.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          href="/log/"
        >
          Open your log
        </Link>
        <Link
          className="rounded-md border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
          href="/map/"
        >
          Open map
        </Link>
        <Link
          className="rounded-md px-4 py-2.5 text-sm font-medium text-slate-600 underline dark:text-slate-300"
          href="/login/"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
