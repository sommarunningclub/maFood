export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-[calc(3.25rem_+_env(safe-area-inset-top))] lg:top-0 z-20 border-b border-palantir-border bg-palantir-bg/85 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-fluid-xl font-semibold text-white truncate">{title}</h1>
          {subtitle && (
            <p className="mono text-[11px] sm:text-xs text-palantir-muted truncate">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
