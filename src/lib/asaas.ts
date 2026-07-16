/*
  Cliente Asaas para cobrança Pix.
  Padrões adotados a partir da integração de referência (somma-site-assessoria-esportiva):
    - URL normalizada (aceita "https://api.asaas.com" ou "...api.asaas.com/v3")
    - Header `access_token` (não Bearer)
    - Erros mapeados pra `errors[0].description` quando presente
    - CPF/telefone sanitizados (apenas dígitos) antes de mandar

  Produção:  ASAAS_BASE_URL=https://api.asaas.com/v3
  Sandbox:   ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
  Sem chave  → erro explícito (não devolve QR/payload falso). Para dev local
               sem Asaas, defina ASAAS_ALLOW_SIMULATED=true para reativar o
               modo simulado conscientemente.

  Docs: https://docs.asaas.com/
*/
import { logServerError } from "@/lib/server-errors";

function normalizeBaseUrl(raw: string | undefined): string {
  const base = (raw || "https://api.asaas.com/v3").replace(/\/+$/, "");
  return base.endsWith("/v3") ? base : `${base}/v3`;
}

const BASE_URL = normalizeBaseUrl(process.env.ASAAS_BASE_URL);
const API_KEY = process.env.ASAAS_API_KEY ?? "";

export const asaasEnabled = !!API_KEY;
export const asaasIsProd = BASE_URL.includes("api.asaas.com") && !BASE_URL.includes("sandbox");

// Modo simulado agora exige opt-in explícito. Sem a chave e sem esse flag, as
// funções lançam erro em vez de devolver QR/payload falsos (que o banco recusa).
const asaasAllowSimulated = process.env.ASAAS_ALLOW_SIMULATED === "true";
const ASAAS_NOT_CONFIGURED =
  "Pagamento indisponível: Asaas não configurado (ASAAS_API_KEY ausente). " +
  "Em dev, defina ASAAS_ALLOW_SIMULATED=true para usar o modo simulado.";

// Retorna true quando devemos devolver dados simulados; lança quando o Asaas
// não está configurado e o modo simulado não foi liberado.
function isSimulated(): boolean {
  if (asaasEnabled) return false;
  if (asaasAllowSimulated) return true;
  throw new Error(ASAAS_NOT_CONFIGURED);
}

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
  /** Valor líquido após a tarifa efetivamente cobrada pelo Asaas. */
  netValue?: number;
  billingType?: string;
  invoiceUrl?: string;
  refunds?: AsaasRefund[];
}

export interface AsaasRefund {
  dateCreated: string;
  status: "PENDING" | "CANCELLED" | "DONE";
  value: number;
  description?: string | null;
  endToEndIdentifier?: string | null;
  transactionReceiptUrl?: string | null;
}

export interface AsaasAccountFees {
  payment?: {
    pix?: {
      fixedFeeValue?: number | null;
      fixedFeeValueWithDiscount?: number | null;
      percentageFee?: number | null;
      minimumFeeValue?: number | null;
      maximumFeeValue?: number | null;
      discountExpiration?: string | null;
      monthlyCreditsWithoutFee?: number | null;
      creditsReceivedOfCurrentMonth?: number | null;
    };
    creditCard?: {
      operationValue?: number | null;
      oneInstallmentPercentage?: number | null;
      discountOneInstallmentPercentage?: number | null;
      discountExpiration?: string | null;
      daysToReceive?: number | null;
    };
  };
  anticipation?: {
    creditCard?: {
      /** Taxa mensal para antecipar uma cobrança de cartão à vista. */
      detachedMonthlyFeeValue?: number | null;
      /** Taxa mensal para antecipar cobranças parceladas. */
      installmentMonthlyFeeValue?: number | null;
    };
    bankSlip?: {
      monthlyFeePercentage?: number | null;
    };
    pix?: {
      monthlyFeePercentage?: number | null;
    };
  };
}

export interface AsaasPixQr {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
}

export interface AsaasCardInput {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
  dueDate: string;
  remoteIp: string;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
    addressComplement?: string;
  };
}

export interface AsaasCardPayment extends AsaasPayment {
  // status para cartão pode vir CONFIRMED na hora se aprovado
  creditCard?: {
    creditCardBrand?: string;
    creditCardNumber?: string;
    creditCardToken?: string;
  };
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

/** Tarifas vigentes da conta Asaas (Pix, cartão etc.). */
export async function getAccountFees(): Promise<AsaasAccountFees> {
  if (isSimulated()) return {};
  return asaasFetch<AsaasAccountFees>("/myAccount/fees/");
}

/** Dados financeiros reais de uma cobrança, incluindo `netValue`. */
export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  if (isSimulated()) {
    return { id: paymentId, status: "RECEIVED", value: 0, netValue: 0 };
  }
  return asaasFetch<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/**
 * Solicita o reembolso integral de uma cobrança confirmada/recebida.
 * O Asaas usa o valor total quando `value` não é enviado.
 */
export async function refundPayment(
  paymentId: string,
  description?: string
): Promise<AsaasPayment> {
  if (isSimulated()) {
    return {
      id: paymentId,
      status: "REFUNDED",
      value: 0,
      refunds: [
        {
          dateCreated: new Date().toISOString(),
          status: "DONE",
          value: 0,
          description: description || null,
          transactionReceiptUrl: null,
        },
      ],
    };
  }

  return asaasFetch<AsaasPayment>(
    `/payments/${encodeURIComponent(paymentId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({
        description: description?.trim() || undefined,
      }),
    }
  );
}

export async function findOrCreateCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
  const cpf = onlyDigits(input.cpfCnpj);
  if (isSimulated()) {
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
  if (isSimulated()) {
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
  if (isSimulated()) {
    return {
      encodedImage: "",
      payload: `00020126BR.GOV.BCB.PIX SIMULATED ${paymentId} ${Date.now()}`,
    };
  }
  return asaasFetch<AsaasPixQr>(`/payments/${paymentId}/pixQrCode`);
}

/*
  Cobrança com cartão de crédito (checkout transparente).
  Asaas processa na hora; status final pode vir CONFIRMED, RECEIVED, ou
  AWAITING_RISK_ANALYSIS — só CONFIRMED/RECEIVED dispensa esperar webhook.
  Em falha de validação do cartão, Asaas retorna 4xx com errors[0].description
  (ex: "O CCV informado é inválido"). Repasse a mensagem pro usuário.
*/
export async function createCardPayment(input: AsaasCardInput): Promise<AsaasCardPayment> {
  if (isSimulated()) {
    return {
      id: `sim_card_${input.externalReference}_${Date.now()}`,
      status: "CONFIRMED",
      value: input.value,
      invoiceUrl: undefined,
    };
  }
  const sanitize = (s: string) => s.replace(/\D/g, "");
  return asaasFetch<AsaasCardPayment>(`/payments`, {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "CREDIT_CARD",
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
      remoteIp: input.remoteIp,
      creditCard: {
        holderName: input.creditCard.holderName.trim(),
        number: sanitize(input.creditCard.number),
        expiryMonth: input.creditCard.expiryMonth.padStart(2, "0"),
        expiryYear: input.creditCard.expiryYear.length === 2
          ? `20${input.creditCard.expiryYear}`
          : input.creditCard.expiryYear,
        ccv: sanitize(input.creditCard.ccv),
      },
      creditCardHolderInfo: {
        name: input.creditCardHolderInfo.name.trim(),
        email: input.creditCardHolderInfo.email.trim(),
        cpfCnpj: sanitize(input.creditCardHolderInfo.cpfCnpj),
        postalCode: sanitize(input.creditCardHolderInfo.postalCode),
        addressNumber: input.creditCardHolderInfo.addressNumber.trim(),
        addressComplement: input.creditCardHolderInfo.addressComplement?.trim() || undefined,
        phone: input.creditCardHolderInfo.phone ? sanitize(input.creditCardHolderInfo.phone) : undefined,
      },
    }),
  });
}

/*
  Cancela (deleta) uma cobrança no Asaas. Só faz sentido enquanto pendente —
  cobranças confirmadas/recebidas não devem ser canceladas por aqui.
  Best-effort: se falhar (já paga, inexistente), apenas loga e segue.
*/
export async function cancelPayment(paymentId: string): Promise<boolean> {
  if (!asaasEnabled) return true;
  try {
    await asaasFetch(`/payments/${paymentId}`, { method: "DELETE" });
    return true;
  } catch (err) {
    logServerError("asaas-cancel-payment", err);
    return false;
  }
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
