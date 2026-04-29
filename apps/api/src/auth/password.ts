import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, keyLength)) as Buffer;
  return `scrypt:v1:${salt}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, version, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || version !== "v1" || !salt || !hash) {
    return false;
  }

  const actual = (await scrypt(password, salt, keyLength)) as Buffer;
  const expected = Buffer.from(hash, "base64url");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
