export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-palantir-border bg-palantir-bg/80 px-6 py-4 backdrop-blur">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="mono text-xs text-palantir-muted">{subtitle}</p>}
    </header>
  );
}
