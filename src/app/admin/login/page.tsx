import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const session = await getAdminSession();
  if (session) redirect(searchParams.next ?? "/admin");

  // Se ainda não há admin cadastrado, redireciona pra rota de setup
  const supa = createAdminClient();
  const { count } = await supa.from("admins").select("id", { count: "exact", head: true });
  if ((count ?? 0) === 0) redirect("/admin/setup");

  return <AdminLoginForm next={searchParams.next} />;
}
