import { redirect } from "next/navigation";

/** Roles live as a tab on Users (`?tab=roles`), visible to owner/admin only. */
export default function AdminRolesRedirectPage() {
  redirect("/admin/users?tab=roles");
}
