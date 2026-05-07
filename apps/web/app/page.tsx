import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <p className="text-sm font-medium tracking-wide text-sage-200">MVP</p>
      <h1 className="mt-1 font-serif text-4xl text-sage-50">Track & rate coffee</h1>
      <p className="mt-4 text-lg leading-relaxed text-sage-100">
        Log what you drink (home or cafe), add roasters and coffees, and explore a map of
        roasters and cafes — without selling beans.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-md bg-sage-100 px-4 py-2.5 text-sm font-medium text-sage-900 hover:bg-sage-200"
          href="/log/"
        >
          Open your log
        </Link>
        <Link
          className="rounded-md border border-sage-200 bg-sage-50/90 px-4 py-2.5 text-sm font-medium text-sage-900 hover:bg-sage-100"
          href="/map/"
        >
          Open map
        </Link>
        <Link
          className="rounded-md px-4 py-2.5 text-sm font-medium text-sage-100 underline"
          href="/login/"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
