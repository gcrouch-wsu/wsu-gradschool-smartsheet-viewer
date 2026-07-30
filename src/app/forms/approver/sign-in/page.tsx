import { redirect } from "next/navigation";

/** Legacy approver sign-in — folded into unified admin/coordinator sign-in. */
export default function ApproverSignInRedirectPage() {
  redirect("/admin/sign-in?next=/forms/sheet");
}
