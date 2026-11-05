import { redirect } from "next/navigation";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
import { StudentSubmissionTable } from "@/components/forms/student/StudentSubmissionTable";
import { readStudentPortalEmail } from "@/lib/forms/student-portal-access";

export const dynamic = "force-dynamic";

export default async function StudentSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ sheetId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const portal = await readStudentPortalEmail();
  if (!portal.email) redirect("/student");
  const [{ sheetId }, { page }] = await Promise.all([params, searchParams]);

  return (
    <StudentPageFrame
      breadcrumbs={[
        { href: "/student", label: "Student portal" },
        { href: null, label: "Submission sheet" },
      ]}
      title="Submission sheet"
      description="Search your submissions and select one to view its details."
      showSignOut={!portal.preview}
      previewEmail={portal.preview ? portal.email : null}
    >
      <StudentSubmissionTable sheetId={sheetId} page={page} />
    </StudentPageFrame>
  );
}
