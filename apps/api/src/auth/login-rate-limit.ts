const maxAttempts = 8;
const windowMs = 15 * 60 * 1000;

type AttemptWindow = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptWindow>();

function readWindow(key: string, now: number) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 0, resetAt: now + windowMs };
    attempts.set(key, next);
    return next;
  }
  return current;
}

export function consumeLoginAttempt(key: string) {
  const now = Date.now();
  const current = readWindow(key, now);

  if (current.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetLoginAttempts(key: string) {
  attempts.delete(key);
}
