/*
  Logo do PDV — aceita emoji (texto curto) OU URL de imagem.
  Detecta automaticamente pela string em `logo_url`:
  - começa com http(s):// ou /  → renderiza <img>
  - caso contrário              → renderiza como texto (emoji)
*/

export function isImageLogo(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(https?:\/\/|\/)/.test(value);
}

export function PdvLogo({
  logoUrl,
  size = 32,
  className = "",
  alt = "",
}: {
  logoUrl: string | null | undefined;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const v = logoUrl ?? "";
  if (isImageLogo(v)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={v}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-admin object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-grid place-items-center shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.7) }}
      aria-label={alt || undefined}
    >
      {v || "🍽"}
    </span>
  );
}
