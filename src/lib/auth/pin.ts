import bcrypt from "bcryptjs";

const ROUNDS = 10;

/** Hash do PIN. Chame só no server. */
export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("PIN deve ter entre 4 e 8 digitos");
  }
  return bcrypt.hash(pin, ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(pin, hash);
  } catch {
    return false;
  }
}
