/** Cliente tem dados mínimos para cobrança Asaas com cartão. */
export function customerReadyForCard(c: {
  email?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  address_number?: string | null;
}): boolean {
  const email = (c.email ?? "").trim();
  const phone = (c.phone ?? "").replace(/\D/g, "");
  const cep = (c.postal_code ?? "").replace(/\D/g, "");
  const number = (c.address_number ?? "").trim();
  return (
    email.includes("@") &&
    phone.length >= 10 &&
    cep.length === 8 &&
    number.length >= 1
  );
}
