export function SectionHeading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`mafood-section-title text-xl leading-tight ${className}`}>
      {children}
    </h2>
  );
}
