"use client";

/**
 * GIF de marca SommaFood — usa <img> nativo para preservar a animação
 * (next/image pode otimizar GIF e “congelar” o loop).
 */
export function BrandMomentGif({
  variant,
  size = 160,
  className = "",
  alt,
}: {
  variant: "cart" | "success";
  size?: number;
  className?: string;
  alt?: string;
}) {
  const src = variant === "success" ? "/bebendo2.gif" : "/bebendo.gif";
  const label =
    alt ??
    (variant === "success"
      ? "Pagamento aprovado"
      : "SommaFood");

  return (
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      decoding="async"
      className={`mx-auto object-contain select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, maxWidth: "100%" }}
    />
  );
}
