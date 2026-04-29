import { createHmac, timingSafeEqual } from "node:crypto";

export type AdminSession = {
  sub: string;
  exp: number;
  iat: number;
};

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createSessionToken(username: string, secret: string, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSession = {
    sub: username,
    iat: now,
    exp: now + ttlSeconds
  };

  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string): AdminSession | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    const now = Math.floor(Date.now() / 1000);

    if (!session.sub || !Number.isInteger(session.exp) || session.exp <= now) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
