type Task = {
  url: string;
  resolve: () => void;
  reject: () => void;
};

let maxConcurrent = 2;
let active = 0;
const queue: Task[] = [];

// Dedupe in-flight and completed prefetches.
const cache = new Map<string, Promise<void>>();

function pump() {
  while (active < maxConcurrent && queue.length > 0) {
    const task = queue.shift();
    if (!task) return;

    active++;

    const img = new Image();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      active--;
      pump();
    };

    img.onload = () => {
      cleanup();
      task.resolve();
    };

    img.onerror = () => {
      cleanup();
      task.reject();
    };

    img.src = task.url;
  }
}

export function setMaxConcurrentImagePrefetch(next: number) {
  maxConcurrent = Math.max(0, Math.min(6, Math.trunc(next)));
  pump();
}

export function prefetchImage(url: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!url) return Promise.resolve();

  const existing = cache.get(url);
  if (existing) return existing;

  if (maxConcurrent <= 0) {
    const noop = Promise.resolve();
    cache.set(url, noop);
    return noop;
  }

  const promise = new Promise<void>((resolve, reject) => {
    queue.push({
      url,
      resolve,
      reject
    });
    pump();
  }).catch(() => {
    // If it failed, allow retry in future.
    cache.delete(url);
  });

  cache.set(url, promise);
  return promise;
}
