import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para o browser. Aponta para o schema `mafood` por padrão.
// (No banco há outro sistema em `public`; isolamos via schema dedicado.)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "mafood" } }
  );
}

// Cliente browser apontando para `public` (lista_vip_publico vive lá).
export function createPublicClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "public" } }
  );
}
