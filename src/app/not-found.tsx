import Link from "next/link";
import { FORM_BRAND_HEADER_ACTION_SOLID_CLASS } from "@/components/layout/AppBrandHeader";
import { StatusPage } from "@/components/StatusPage";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="That address is not part of this workspace. Check the link, or go back to the home page."
      actions={
        <Link href="/" className={FORM_BRAND_HEADER_ACTION_SOLID_CLASS}>
          Back to home
        </Link>
      }
    />
  );
}
