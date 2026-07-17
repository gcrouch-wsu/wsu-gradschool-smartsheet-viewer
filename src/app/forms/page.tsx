import { redirect } from "next/navigation";

/** Signed-in submit UI removed — use published `/f/[slug]` or Manage → Builder. */
export default function FormPage() {
  redirect("/forms/tracker");
}
