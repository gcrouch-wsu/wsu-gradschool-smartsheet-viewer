import "../../styles/forms.css";

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
