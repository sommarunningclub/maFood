import { NextResponse } from "next/server";
import { z } from "zod";
import { getPdvSession } from "@/lib/auth/session";
import {
  ImageUploadError,
  MAX_IMAGE_BYTES,
  prepareImageUpload,
  storePdvAsset,
} from "@/lib/image-upload";
import { internalErrorResponse } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";

const KindSchema = z.enum(["product", "combo"]);

export async function POST(req: Request) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

    const parsedKind = KindSchema.safeParse(String(form.get("kind") || "product"));
    if (!parsedKind.success) {
      return NextResponse.json({ error: "Tipo de imagem inválido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: pdv, error: pdvError } = await supabase
      .from("pdvs")
      .select("id")
      .eq("id", session.pdv_id)
      .maybeSingle();
    if (pdvError) {
      return internalErrorResponse("pdv-upload-pdv", pdvError, "Não foi possível validar o PDV");
    }
    if (!pdv) {
      return NextResponse.json({ error: "PDV não encontrado" }, { status: 404 });
    }

    const bytes = await prepareImageUpload(file);
    const asset = await storePdvAsset({
      pdvId: session.pdv_id,
      kind: parsedKind.data,
      bytes,
    });

    return NextResponse.json({ ok: true, ...asset });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return internalErrorResponse("pdv-upload", error, "Não foi possível enviar a imagem");
  }
}
