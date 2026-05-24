import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminSetupForm } from "@/components/admin/admin-setup-form";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  // Self-trava: se já existe admin, manda pra login
  const supa = createAdminClient();
  const { count } = await supa.from("admins").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/admin/login");

  return <AdminSetupForm />;
}
