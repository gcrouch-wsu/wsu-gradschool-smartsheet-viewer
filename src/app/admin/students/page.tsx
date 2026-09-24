import { redirect } from "next/navigation";

/** Students are managed from the unified Users directory. */
export default function AdminStudentsRedirectPage() {
  redirect("/admin/users");
}
