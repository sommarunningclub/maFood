import { clientDisplay, clientMono, clientSans } from "@/lib/fonts/client";

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${clientDisplay.variable} ${clientSans.variable} ${clientMono.variable}`}
    >
      {children}
    </div>
  );
}
