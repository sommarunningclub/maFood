/*
  Cliente Asaas para cobrança Pix.
  - Se ASAAS_API_KEY não estiver configurada → modo simulado (não chama HTTP,
    devolve payload falso para desenvolvimento/teste).
  - Em produção: criar customer (idempotente por externalReference=cpf),
    criar payment Pix, buscar QR code.

  Docs: https://docs.asaas.com/
*/

const BASE_URL = process.env.ASAAS_BASE_URL ?? "https://api-sandbox.asaas.com/v3";
const API_KEY = process.env.ASAAS_API_KEY ?? "";

export const asaasEnabled = !!API_KEY;

interface AsaasCustomerInput {
  name: string;
  cpfCnpj: string;
  email?: string | null;
  phone?: string | null;
  externalReference?: string;
}

interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
}

interface AsaasPaymentInput {
  customerId: string;
  value: number;
  description: string;
  externalReference: string; // order.id
  dueDate: string; // YYYY-MM-DD
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl?: string;
}

export interface AsaasPixQr {
  encodedImage: string; // base64 PNG
  payload: string; // copia-cola Pix
  expirationDate?: string;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: API_KEY,
      ...(init?.headers ?? {}),
      "user-agent": "maFood/1.0",
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail =
      typeof body === "object" && body !== null && "errors" in body
        ? JSON.stringify((body as { errors: unknown }).errors)
        : String(body);
    throw new Error(`Asaas ${res.status}: ${detail}`);
  }
  return body as T;
}

export async function findOrCreateCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
  if (!asaasEnabled) {
    return { id: `sim_cus_${input.cpfCnpj}`, name: input.name, cpfCnpj: input.cpfCnpj };
  }
  // Busca por cpfCnpj evita duplicar
  const list = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(input.cpfCnpj)}&limit=1`
  );
  if (list.data?.[0]) return list.data[0];

  return asaasFetch<AsaasCustomer>(`/customers`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email ?? undefined,
      mobilePhone: input.phone ?? undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    }),
  });
}

export async function createPixPayment(input: AsaasPaymentInput): Promise<AsaasPayment> {
  if (!asaasEnabled) {
    return {
      id: `sim_pay_${input.externalReference}`,
      status: "PENDING",
      value: input.value,
      invoiceUrl: undefined,
    };
  }
  return asaasFetch<AsaasPayment>(`/payments`, {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "PIX",
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export async function getPixQr(paymentId: string): Promise<AsaasPixQr> {
  if (!asaasEnabled) {
    return {
      encodedImage: "",
      payload: `00020126BR.GOV.BCB.PIX SIMULATED ${paymentId} ${Date.now()}`,
    };
  }
  return asaasFetch<AsaasPixQr>(`/payments/${paymentId}/pixQrCode`);
}

/*
  Webhook helper: valida o token enviado pelo Asaas via header
  `asaas-access-token`. Em modo simulado, aceita qualquer token
  (apenas pra facilitar dev local).
*/
export function isValidWebhookToken(received: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  if (!expected) return !asaasEnabled; // sem token configurado, só aceita em dev/simulado
  return received === expected;
}
