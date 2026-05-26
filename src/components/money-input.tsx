"use client";

/*
  MoneyInput — input monetário no padrão pt-BR ("1.234,56").

  - Internamente armazena apenas dígitos (centavos), formata na exibição
  - Aceita backspace livre (zero não fica preso)
  - Retorna number (em reais) via onChange
  - Quando o valor é 0, exibe vazio com placeholder "0,00"
*/

import { forwardRef, useEffect, useState } from "react";

function digitsToBRL(digits: string): string {
  if (!digits) return "";
  // Remove zeros à esquerda mas mantém ao menos 1 dígito
  const clean = digits.replace(/^0+(?=\d)/, "") || "0";
  const padded = clean.padStart(3, "0");
  const reais = padded.slice(0, -2);
  const cents = padded.slice(-2);
  const reaisFmt = parseInt(reais, 10).toLocaleString("pt-BR");
  return `${reaisFmt},${cents}`;
}

function digitsToNumber(digits: string): number {
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

function numberToDigits(n: number | null | undefined): string {
  if (n == null || n === 0 || isNaN(n)) return "";
  return Math.round(n * 100).toString();
}

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (n: number) => void;
}

export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, placeholder = "0,00", className = "", ...rest },
  ref
) {
  const [digits, setDigits] = useState(() => numberToDigits(value));

  // Sincroniza quando o `value` muda externamente (ex.: reset, edição)
  useEffect(() => {
    const incoming = numberToDigits(value);
    setDigits((cur) => (digitsToNumber(cur) === value ? cur : incoming));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const onlyDigits = e.target.value.replace(/\D/g, "");
    setDigits(onlyDigits);
    onChange(digitsToNumber(onlyDigits));
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={digitsToBRL(digits)}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
});
