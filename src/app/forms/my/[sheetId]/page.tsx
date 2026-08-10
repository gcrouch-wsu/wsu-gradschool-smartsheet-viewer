import { redirect } from "next/navigation";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
import { StudentSubmissionTable } from "@/components/forms/student/StudentSubmissionTable";
import { readStudentSessionEmail } from "@/lib/forms/student-auth";

export const dynamic = "force-dynamic";

export default async function StudentSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ sheetId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const email = await readStudentSessionEmail();
  if (!email) redirect("/forms/my");
  const [{ sheetId }, { page }] = await Promise.all([params, searchParams]);

  return (
    <StudentPageFrame
      breadcrumbs={[
        { href: "/forms/my", label: "My submissions" },
        { href: null, label: "Submission sheet" },
      ]}
      title="Submission sheet"
      description="Search your submissions and select one to view its details."
    >
      <StudentSubmissionTable sheetId={sheetId} page={page} />
    </StudentPageFrame>
  );
}
