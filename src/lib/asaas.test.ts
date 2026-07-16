import { afterEach, describe, expect, it, vi } from "vitest";

const originalApiKey = process.env.ASAAS_API_KEY;
const originalBaseUrl = process.env.ASAAS_BASE_URL;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  if (originalApiKey === undefined) delete process.env.ASAAS_API_KEY;
  else process.env.ASAAS_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.ASAAS_BASE_URL;
  else process.env.ASAAS_BASE_URL = originalBaseUrl;
});

describe("refundPayment", () => {
  it("solicita reembolso integral sem enviar value", async () => {
    process.env.ASAAS_API_KEY = "test-key";
    process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pay_123",
          status: "REFUNDED",
          value: 25,
          refunds: [
            {
              dateCreated: "2026-07-15 21:00:00",
              status: "DONE",
              value: 25,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { refundPayment } = await import("@/lib/asaas");
    const payment = await refundPayment("pay_123", "Cliente desistiu");

    expect(payment.status).toBe("REFUNDED");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://api-sandbox.asaas.com/v3/payments/pay_123/refund"
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      description: "Cliente desistiu",
    });
    expect(JSON.parse(String(init.body))).not.toHaveProperty("value");
  });
});

describe("findOrCreateCustomer", () => {
  it("cria cliente com notificações Asaas desabilitadas", async () => {
    process.env.ASAAS_API_KEY = "test-key";
    process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "cus_new",
            name: "Cliente Novo",
            cpfCnpj: "04753265050",
            notificationDisabled: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const { findOrCreateCustomer } = await import("@/lib/asaas");
    const customer = await findOrCreateCustomer({
      name: "Cliente Novo",
      cpfCnpj: "047.532.650-50",
      email: "cliente@example.com",
      phone: "61999999999",
      externalReference: "cust_1",
    });

    expect(customer.notificationDisabled).toBe(true);
    const [, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(createInit.body))).toMatchObject({
      notificationDisabled: true,
    });
  });

  it("desliga notificações em cliente Asaas já existente", async () => {
    process.env.ASAAS_API_KEY = "test-key";
    process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "cus_old",
                name: "Cliente Antigo",
                cpfCnpj: "04753265050",
                notificationDisabled: false,
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "cus_old",
            name: "Cliente Antigo",
            cpfCnpj: "04753265050",
            notificationDisabled: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const { findOrCreateCustomer } = await import("@/lib/asaas");
    const customer = await findOrCreateCustomer({
      name: "Cliente Antigo",
      cpfCnpj: "04753265050",
    });

    expect(customer.notificationDisabled).toBe(true);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/customers/cus_old");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      notificationDisabled: true,
    });
  });
});
