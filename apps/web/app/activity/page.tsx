"use client";

import { ActivityFeed } from "@/components/ActivityFeed";

export default function ActivityPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-serif text-3xl text-foreground">Activity</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Public check-ins from across the community.
      </p>
      <ActivityFeed />
    </div>
  );
}
