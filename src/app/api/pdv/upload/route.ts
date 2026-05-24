/*
  Upload de imagem scoped ao PDV autenticado. Reusa o bucket `pdv-assets`.
  Caminho: pdvs/<pdv_id>/<kind>/<uuid>.<ext>  (kind = product | combo).
*/
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const kindRaw = String(form.get("kind") || "product");
  const kind = ["product", "combo"].includes(kindRaw) ? kindRaw : "product";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file obrigatorio" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo maior que 5MB" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Apenas imagens" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `pdvs/${session.pdv_id}/${kind}/${crypto.randomUUID()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from("pdv-assets")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("pdv-assets").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}
