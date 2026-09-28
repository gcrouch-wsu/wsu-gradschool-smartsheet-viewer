import { describe, expect, it } from "vitest";
import { filterPlatformUsers } from "@/components/admin/PlatformUsersManager";
import type { AssignablePlatformRole, PlatformUserSummary } from "@/lib/platform-user-types";

function user(
  partial: Partial<PlatformUserSummary> & Pick<PlatformUserSummary, "id" | "email" | "roles">,
): PlatformUserSummary {
  return {
    isActive: true,
    hasPassword: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const sample: PlatformUserSummary[] = [
  user({ id: "1", email: "admin@wsu.edu", displayName: "Ada Admin", roles: ["admin"] }),
  user({
    id: "2",
    email: "coord@wsu.edu",
    displayName: "Chris Coord",
    roles: ["coordinator", "approver"],
    isActive: false,
  }),
  user({ id: "3", email: "student@wsu.edu", roles: ["student"], hasPassword: false }),
  user({ id: "4", email: "both@wsu.edu", displayName: "Pat Both", roles: ["contributor", "student"] }),
];

describe("filterPlatformUsers", () => {
  it("filters by role including multi-role users", () => {
    expect(filterPlatformUsers(sample, "", "student", "all").map((u) => u.id)).toEqual(["3", "4"]);
    expect(filterPlatformUsers(sample, "", "admin", "all").map((u) => u.id)).toEqual(["1"]);
  });

  it("filters by status", () => {
    expect(filterPlatformUsers(sample, "", "all", "inactive").map((u) => u.id)).toEqual(["2"]);
    expect(filterPlatformUsers(sample, "", "all", "pending_password").map((u) => u.id)).toEqual(["3"]);
    expect(filterPlatformUsers(sample, "", "all", "active").map((u) => u.id)).toEqual(["1", "3", "4"]);
  });

  it("combines search with role and status", () => {
    expect(filterPlatformUsers(sample, "pat", "student", "all").map((u) => u.id)).toEqual(["4"]);
    expect(filterPlatformUsers(sample, "coord", "all", "inactive").map((u) => u.id)).toEqual(["2"]);
    expect(filterPlatformUsers(sample, "admin", "student" as AssignablePlatformRole, "all")).toEqual([]);
  });
});
