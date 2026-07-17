"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActivityFilters({
  actorId: initialActorId,
  resourceType: initialResourceType,
}: {
  actorId: string;
  resourceType: string;
}) {
  const router = useRouter();
  const [actorId, setActorId] = useState(initialActorId);
  const [resourceType, setResourceType] = useState(initialResourceType);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (actorId.trim()) params.set("actorId", actorId.trim());
    if (resourceType.trim()) params.set("resourceType", resourceType.trim());
    const qs = params.toString();
    router.push(qs ? `/admin/activity?${qs}` : "/admin/activity");
  }

  return (
    <form onSubmit={applyFilters} className="flex flex-wrap gap-2">
      <input
        type="text"
        placeholder="Filter by actor id"
        value={actorId}
        onChange={(e) => setActorId(e.target.value)}
        className="rounded-lg border border-line-strong px-3 py-2 text-sm"
      />
      <input
        type="text"
        placeholder="Filter by resource type"
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value)}
        className="rounded-lg border border-line-strong px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-lg bg-crimson px-4 py-2 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
