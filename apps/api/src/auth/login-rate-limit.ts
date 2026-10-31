const maxAttempts = 8;
const windowMs = 15 * 60 * 1000;

type AttemptWindow = {
  count: number;
  resetAt: number;
};

/** In-memory login limiter: at most 8 attempts per key (client IP) per 15 minutes. Single-instance only. */
export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();

  private readWindow(key: string, now: number) {
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 0, resetAt: now + windowMs };
      this.attempts.set(key, next);
      return next;
    }
    return current;
  }

  consume(key: string) {
    const now = Date.now();
    this.prune(now);
    const current = this.readWindow(key, now);

    if (current.count >= maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key: string) {
    this.attempts.delete(key);
  }

  private prune(now: number) {
    for (const [key, window] of this.attempts) {
      if (window.resetAt <= now) {
        this.attempts.delete(key);
      }
    }
  }
}
