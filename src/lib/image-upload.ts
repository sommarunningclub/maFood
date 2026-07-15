import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_EDGE = 2400;
const OUTPUT_QUALITY = 84;
const BUCKET = "pdv-assets";

export type PdvAssetKind = "logo" | "product" | "combo";
type SourceImageFormat = "jpeg" | "png" | "webp";

const ALLOWED_KINDS = new Set<PdvAssetKind>(["logo", "product", "combo"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_BY_FORMAT: Record<SourceImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class ImageUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ImageUploadError";
  }
}

export function detectImageFormat(bytes: Uint8Array): SourceImageFormat | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

export async function prepareImageUpload(file: File): Promise<Buffer> {
  if (file.size === 0) {
    throw new ImageUploadError("O arquivo está vazio", 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError("A imagem deve ter no máximo 5 MB", 413);
  }

  const input = Buffer.from(await file.arrayBuffer());
  const format = detectImageFormat(input);
  if (!format) {
    throw new ImageUploadError("Use uma imagem JPEG, PNG ou WebP válida", 415);
  }

  const expectedMime = MIME_BY_FORMAT[format];
  if (file.type && file.type !== expectedMime) {
    throw new ImageUploadError("O tipo informado não corresponde ao conteúdo da imagem", 415);
  }

  try {
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new ImageUploadError("Não foi possível ler as dimensões da imagem", 422);
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new ImageUploadError("Imagens animadas não são aceitas", 415);
    }

    const output = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: OUTPUT_QUALITY, effort: 4 })
      .toBuffer();

    if (output.length > MAX_IMAGE_BYTES) {
      throw new ImageUploadError("A imagem processada excede 5 MB", 413);
    }
    return output;
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError("O conteúdo da imagem é inválido ou está corrompido", 422);
  }
}

export async function storePdvAsset({
  pdvId,
  kind,
  bytes,
}: {
  pdvId: string;
  kind: PdvAssetKind;
  bytes: Buffer;
}) {
  if (!UUID_PATTERN.test(pdvId) || !ALLOWED_KINDS.has(kind)) {
    throw new ImageUploadError("Destino de upload inválido", 400);
  }

  const path = `pdvs/${pdvId}/${kind}/${crypto.randomUUID()}.webp`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
