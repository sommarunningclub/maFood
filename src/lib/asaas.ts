/*
  Cliente Asaas para cobrança Pix.
  Padrões adotados a partir da integração de referência (somma-site-assessoria-esportiva):
    - URL normalizada (aceita "https://api.asaas.com" ou "...api.asaas.com/v3")
    - Header `access_token` (não Bearer)
    - Erros mapeados pra `errors[0].description` quando presente
    - CPF/telefone sanitizados (apenas dígitos) antes de mandar

  Produção:  ASAAS_BASE_URL=https://api.asaas.com/v3
  Sandbox:   ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
  Sem chave  → modo simulado (devolve payload falso para dev local).

  Docs: https://docs.asaas.com/
*/

function normalizeBaseUrl(raw: string | undefined): string {
  const base = (raw || "https://api.asaas.com/v3").replace(/\/+$/, "");
  return base.endsWith("/v3") ? base : `${base}/v3`;
}

const BASE_URL = normalizeBaseUrl(process.env.ASAAS_BASE_URL);
const API_KEY = process.env.ASAAS_API_KEY ?? "";

export const asaasEnabled = !!API_KEY;
export const asaasIsProd = BASE_URL.includes("api.asaas.com") && !BASE_URL.includes("sandbox");

const onlyDigits = (s?: string | null) => (s ? s.replace(/\D/g, "") : "");

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
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  invoiceUrl?: string;
}

export interface AsaasPixQr {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
}

interface AsaasErrorBody {
  errors?: Array<{ code?: string; description?: string }>;
  message?: string;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: API_KEY,
      "user-agent": "maFood/1.0",
      ...(init?.headers ?? {}),
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
    const err = body as AsaasErrorBody | null;
    const detail =
      err?.errors?.[0]?.description ||
      err?.message ||
      (typeof body === "string" ? body : `HTTP ${res.status}`);
    const e = new Error(`Asaas ${res.status}: ${detail}`);
    // anexa contexto pra logs
    (e as Error & { status?: number; body?: unknown }).status = res.status;
    (e as Error & { status?: number; body?: unknown }).body = body;
    throw e;
  }
  return body as T;
}

export async function findOrCreateCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
  const cpf = onlyDigits(input.cpfCnpj);
  if (!asaasEnabled) {
    return { id: `sim_cus_${cpf}`, name: input.name, cpfCnpj: cpf };
  }
  // Busca por cpfCnpj evita duplicar
  const list = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=1`
  );
  if (list.data?.[0]) return list.data[0];

  const phone = onlyDigits(input.phone);
  return asaasFetch<AsaasCustomer>(`/customers`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: cpf,
      email: input.email || undefined,
      // Asaas usa `mobilePhone` para celular (11 dígitos) e `phone` para fixo
      mobilePhone: phone.length === 11 ? phone : undefined,
      phone: phone && phone.length !== 11 ? phone : undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    }),
  });
}

export async function createPixPayment(input: AsaasPaymentInput): Promise<AsaasPayment> {
  if (!asaasEnabled) {
    return {
      id: `sim_pay_${input.externalReference}_${Date.now()}`,
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
  `asaas-access-token`. Em modo simulado (sem chave), aceita qualquer token
  pra facilitar dev local.
*/
export function isValidWebhookToken(received: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  if (!expected) return !asaasEnabled;
  return received === expected;
}
