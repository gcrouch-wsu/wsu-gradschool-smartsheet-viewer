import { redirect } from "next/navigation";

/** Contributors are managed from the unified Users directory. */
export default function AdminContributorsRedirectPage() {
  redirect("/admin/users");
}
