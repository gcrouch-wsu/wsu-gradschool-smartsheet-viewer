import "../forms/forms.css";

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
      <main>{children}</main>
    </div>
  );
}
