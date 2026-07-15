import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/admin-session";
import {
  ImageUploadError,
  MAX_IMAGE_BYTES,
  prepareImageUpload,
  storePdvAsset,
  type PdvAssetKind,
} from "@/lib/image-upload";
import { internalErrorResponse } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";

const DestinationSchema = z.object({
  pdvId: z.string().uuid(),
  kind: z.enum(["logo", "product", "combo"]),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES + 256 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB" }, { status: 413 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione uma imagem" }, { status: 400 });
    }

    const parsed = DestinationSchema.safeParse({
      pdvId: form.get("pdv_id"),
      kind: String(form.get("kind") || "product"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Destino de upload inválido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: pdv, error: pdvError } = await supabase
      .from("pdvs")
      .select("id")
      .eq("id", parsed.data.pdvId)
      .maybeSingle();
    if (pdvError) {
      return internalErrorResponse("admin-upload-pdv", pdvError, "Não foi possível validar o PDV");
    }
    if (!pdv) {
      return NextResponse.json({ error: "PDV não encontrado" }, { status: 404 });
    }

    const bytes = await prepareImageUpload(file);
    const asset = await storePdvAsset({
      pdvId: parsed.data.pdvId,
      kind: parsed.data.kind as PdvAssetKind,
      bytes,
    });
    return NextResponse.json({ ok: true, ...asset });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return internalErrorResponse("admin-upload", error, "Não foi possível enviar a imagem");
  }
}
