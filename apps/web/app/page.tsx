import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium tracking-wide text-muted-foreground">MVP</p>
          <h1 className="font-heading font-serif text-4xl leading-snug font-medium">Track & rate coffee</h1>
          <CardDescription className="text-lg leading-relaxed">
            Log what you drink (home or cafe), add roasters and coffees, and explore a map of
            roasters and cafes — without selling beans.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            nativeButton={false}
            render={<Link href="/log/" />}
            size="lg"
          >
            Open your log
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/map/" />}
            size="lg"
            variant="outline"
          >
            Open map
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/login/" />}
            size="lg"
            variant="link"
          >
            Log in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
