import { PageHeader } from "@/components/admin/page-header";

export function Placeholder({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl text-palantir-muted">{icon}</div>
          <p className="text-palantir-muted">
            Esta área será habilitada na próxima fase.
          </p>
          <p className="mono mt-2 text-[10px] uppercase tracking-widest text-palantir-muted/60">
            Em desenvolvimento
          </p>
        </div>
      </div>
    </>
  );
}
