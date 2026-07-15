import "../forms/forms.css";

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
      <header className="border-b border-[color:var(--wsu-border)] bg-white px-4 py-3">
        <p className="text-center text-xs font-medium uppercase tracking-[0.14em] text-wsu-crimson">Washington State University</p>
      </header>
      <main>{children}</main>
    </div>
  );
}
