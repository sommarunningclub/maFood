import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { LandingLogin } from "@/components/landing/landing-login";

/*
  Landing pública em `/`.
  - Se já logado: redireciona para o marketplace do evento
  - Senão: mostra canvas "Open Peeps" + login por CPF (consulta dados_insiders)
*/
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getCustomerSession();
  if (session) redirect("/somma-special-day");
  return <LandingLogin />;
}
