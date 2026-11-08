import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;
const DIGITS = 6;
/** Accepts the previous and next code too, for a phone whose clock is slightly off. */
const DRIFT_STEPS = 1;

export function base32Encode(data: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

/** RFC 6238 with SHA-1, six digits and 30-second steps, which every authenticator app supports. */
export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  const number = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 10 ** DIGITS).padStart(DIGITS, "0");
}

export const currentStep = (nowMs: number) => Math.floor(nowMs / 1000 / PERIOD_SECONDS);

/**
 * The time step a code belongs to, or null when it is wrong or was already used: a step at or
 * before `lastStep` cannot be used again, so an observed code cannot be replayed.
 */
export function matchTotp(secret: string, code: string, nowMs: number, lastStep: number | null) {
  if (!/^\d{6}$/.test(code)) return null;
  const given = Buffer.from(code);
  const now = currentStep(nowMs);
  for (let step = now - DRIFT_STEPS; step <= now + DRIFT_STEPS; step++) {
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(given, Buffer.from(totpCode(secret, step)))) return step;
  }
  return null;
}

export function totpUri(secret: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS)
  });
  return `otpauth://totp/${label}?${query}`;
}

/** Ten single-use codes like "K7QPM-2XW9A", about 50 bits each. */
export function newRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const code = base32Encode(randomBytes(7)).slice(0, 10);
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

export const normalizeRecoveryCode = (code: string) =>
  code.trim().toUpperCase().replace(/[\s-]/g, "");
