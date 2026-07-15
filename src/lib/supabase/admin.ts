import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Reads de service_role alimentam páginas dinâmicas (admin/cardápio). Precisam
// ser sempre frescos — desabilita o Next.js/Vercel Data Cache, que caso
// contrário persiste snapshots antigos das queries entre deploys.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

// service_role: ignora RLS. EXCLUSIVAMENTE no servidor.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin envs ausentes");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "mafood" },
    global: { fetch: noStoreFetch },
  });
}

// Variante apontando para o schema `public` (para ler lista_vip via view).
export function createAdminClientPublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin envs ausentes");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
    global: { fetch: noStoreFetch },
  });
}
