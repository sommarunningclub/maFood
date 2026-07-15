export const PIX_EXPIRY_SECONDS = 900;
export const PIX_POLL_MS = 4000;

const PAID_OR_BEYOND = new Set(["paid", "preparing", "ready", "partial", "delivered"]);

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return status != null && PAID_OR_BEYOND.has(status);
}
