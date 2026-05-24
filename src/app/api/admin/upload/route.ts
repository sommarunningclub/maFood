import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Upload de imagem em pdvs/<pdvId>/<kind>/<nome>.<ext>
// Recebe multipart/form-data com campos: file, pdv_id, kind
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const pdvId = form.get("pdv_id");
  const kind = String(form.get("kind") || "product");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file obrigatorio" }, { status: 400 });
  }
  if (typeof pdvId !== "string" || !pdvId) {
    return NextResponse.json({ error: "pdv_id obrigatorio" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo maior que 5MB" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Apenas imagens" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `pdvs/${pdvId}/${kind}/${crypto.randomUUID()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from("pdv-assets")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("pdv-assets").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}
