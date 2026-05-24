import { createClient } from "@/lib/supabase/client";

export const BUCKET = "pdv-assets";

/**
 * Faz upload de uma imagem no bucket pdv-assets em pdvs/<pdvId>/<kind>/<nome>.
 * Devolve a URL pública.
 */
export async function uploadPdvImage(
  pdvId: string,
  kind: "logo" | "product" | "combo",
  file: File
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `pdvs/${pdvId}/${kind}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Remove um arquivo do bucket (delete por URL pública). */
export async function deletePdvImage(publicUrl: string): Promise<void> {
  const supabase = createClient();
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}
