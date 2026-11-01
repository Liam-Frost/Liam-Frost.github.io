import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets stored in the database (e.g. an OAuth refresh token) with AES-256-GCM, keyed by
 * a server secret. A database dump alone does not reveal them.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string, purpose: string) {
    this.key = createHash("sha256").update(`${purpose}:${secret}`).digest();
  }

  seal(plain: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
  }

  /** null when the value is malformed or was sealed with another key. */
  open(sealed: string): string | null {
    try {
      const [iv, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
}
