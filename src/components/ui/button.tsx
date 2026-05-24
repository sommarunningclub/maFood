import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        // Cliente (Somma)
        somma:
          "rounded-client bg-somma-orange text-white hover:bg-somma-orange-dark font-display uppercase tracking-wide",
        sommaOutline:
          "rounded-client border border-somma-border text-somma-text hover:border-somma-orange",
        // Admin / PDV (Palantir)
        admin: "rounded-admin bg-palantir-blue text-white hover:opacity-90",
        adminGhost:
          "rounded-admin border border-palantir-border text-palantir-text hover:bg-palantir-surface2",
        green: "rounded-admin bg-palantir-green text-black hover:opacity-90",
        red: "rounded-admin bg-palantir-red text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        block: "h-12 px-6 w-full text-base",
      },
    },
    defaultVariants: { variant: "somma", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
