import { redirect } from "next/navigation";
import { StudentSubmissionDetail } from "@/components/forms/student/StudentSubmissionDetail";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
import { readStudentSessionEmail } from "@/lib/forms/student-auth";

export const dynamic = "force-dynamic";

export default async function StudentSubmissionDetailPage({
  params,
}: {
  params: Promise<{ sheetId: string; rowId: string }>;
}) {
  const email = await readStudentSessionEmail();
  if (!email) redirect("/forms/my");
  const { sheetId, rowId } = await params;

  return (
    <StudentPageFrame
      breadcrumbs={[
        { href: "/forms/my", label: "My submissions" },
        { href: `/forms/my/${encodeURIComponent(sheetId)}`, label: "Submission sheet" },
        { href: null, label: "Submission detail" },
      ]}
      title="Submission detail"
      description="Review your submission and propose a contact reroute when needed."
    >
      <StudentSubmissionDetail sheetId={sheetId} rowId={rowId} />
    </StudentPageFrame>
  );
}
