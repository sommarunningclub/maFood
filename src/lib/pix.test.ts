import { describe, it, expect } from "vitest";
import { formatCountdown, isPaidStatus, PIX_EXPIRY_SECONDS, PIX_POLL_MS } from "./pix";

describe("formatCountdown", () => {
  it("formata MM:SS com zero-padding", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(9)).toBe("00:09");
  });
  it("nunca retorna negativo", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
  });
});

describe("isPaidStatus", () => {
  it("true para pago ou além", () => {
    for (const s of ["paid", "preparing", "ready", "partial", "delivered"]) {
      expect(isPaidStatus(s)).toBe(true);
    }
  });
  it("false para pending/cancelled/nulo", () => {
    expect(isPaidStatus("pending")).toBe(false);
    expect(isPaidStatus("cancelled")).toBe(false);
    expect(isPaidStatus(null)).toBe(false);
    expect(isPaidStatus(undefined)).toBe(false);
  });
});

describe("constantes", () => {
  it("valores esperados", () => {
    expect(PIX_EXPIRY_SECONDS).toBe(900);
    expect(PIX_POLL_MS).toBe(4000);
  });
});
