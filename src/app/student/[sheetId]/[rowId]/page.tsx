import { redirect } from "next/navigation";
import { StudentSubmissionDetail } from "@/components/forms/student/StudentSubmissionDetail";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
import { readStudentPortalEmail } from "@/lib/forms/student-portal-access";

export const dynamic = "force-dynamic";

export default async function StudentSubmissionDetailPage({
  params,
}: {
  params: Promise<{ sheetId: string; rowId: string }>;
}) {
  const portal = await readStudentPortalEmail();
  if (!portal.email) redirect("/student");
  const { sheetId, rowId } = await params;

  return (
    <StudentPageFrame
      breadcrumbs={[
        { href: "/student", label: "Student portal" },
        { href: `/student/${encodeURIComponent(sheetId)}`, label: "Submission sheet" },
        { href: null, label: "Submission detail" },
      ]}
      title="Submission detail"
      description="Review your submission and propose a contact reroute when needed."
      showSignOut={!portal.preview}
      previewEmail={portal.preview ? portal.email : null}
    >
      <StudentSubmissionDetail sheetId={sheetId} rowId={rowId} previewMode={portal.preview} />
    </StudentPageFrame>
  );
}
