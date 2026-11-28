import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";

/** A link that may not be fetched: not https, a private address, too large, not reachable. */
export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 20_000;

/**
 * Addresses a link may not reach: this machine, private networks, link-local and metadata services,
 * carrier-grade NAT, benchmark networks, multicast and reserved ranges.
 */
const BLOCKED = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
] as const)
  BLOCKED.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["2002::", 16],
  ["ff00::", 8]
] as const)
  BLOCKED.addSubnet(net, bits, "ipv6");

export function isBlockedAddress(address: string) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const ip = mapped ?? address;
  const family = isIP(ip);
  if (!family) return true;
  return BLOCKED.check(ip, family === 6 ? "ipv6" : "ipv4");
}

export type SafeFetchOptions = {
  maxBytes: number;
  fetchImpl?: typeof fetch;
  /** Every address a host name resolves to. */
  lookup?: (host: string) => Promise<string[]>;
};

const resolveAll = async (host: string) =>
  (await dnsLookup(host, { all: true })).map((entry) => entry.address);

/** Checks a link before each request: https, and a host that only resolves to public addresses. */
async function checkUrl(raw: string, lookup: (host: string) => Promise<string[]>) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("链接格式不正确");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("只支持 https 链接");
  if (url.username || url.password) throw new UnsafeUrlError("链接不能包含用户名或密码");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await lookup(host);
  } catch {
    throw new UnsafeUrlError(`无法解析 ${url.hostname}`);
  }
  if (!addresses.length || addresses.some(isBlockedAddress))
    throw new UnsafeUrlError("不能访问内网或本机地址");
  return { url, host, addresses };
}

/** Pass only the DNS answers checked for this hop to the socket. */
export function pinnedLookup(host: string, addresses: string[]): LookupFunction {
  const records = addresses.map((address) => ({ address, family: isIP(address) }));
  return (hostname, options, callback) => {
    const matching = records.filter(
      (record) => !options.family || record.family === options.family
    );
    const first = matching[0];
    if (hostname !== host || !first) {
      callback(new Error("No validated address for host"), "");
      return;
    }
    if (options.all) callback(null, matching);
    else callback(null, first.address, first.family);
  };
}

function downloadHop(url: URL, lookup: LookupFunction, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Keep the URL hostname for the Host header, SNI and certificate verification.
    // A fresh direct socket cannot reuse an unchecked connection or resolve the host again.
    const request = httpsRequest(
      url,
      {
        agent: false,
        lookup,
        signal: init.signal ?? undefined,
        headers: { accept: "image/*,*/*;q=0.5" }
      },
      (incoming) => {
        const status = incoming.statusCode ?? 502;
        const headers = new Headers();
        try {
          for (const [key, value] of Object.entries(incoming.headers)) {
            if (value !== undefined)
              headers.set(key, Array.isArray(value) ? value.join(", ") : value);
          }
          const empty = status === 204 || status === 205 || status === 304;
          if (empty) incoming.resume();
          const body = empty ? null : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>);
          resolve(new Response(body, { status, headers }));
        } catch (error) {
          incoming.destroy();
          reject(error);
        }
      }
    );
    request.once("error", reject);
    request.end();
  });
}

/** Download over a direct HTTPS connection pinned to the validated DNS addresses on every hop. */
export async function fetchPublic(raw: string, options: SafeFetchOptions) {
  const lookup = options.lookup ?? resolveAll;
  let checked = await checkUrl(raw, lookup);
  for (let hop = 0; ; hop++) {
    const { url, host, addresses } = checked;
    let response: Response;
    try {
      const init = {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "image/*,*/*;q=0.5" }
      } satisfies RequestInit;
      response = options.fetchImpl
        ? await options.fetchImpl(url, init)
        : await downloadHop(url, pinnedLookup(host, addresses), init);
    } catch {
      throw new UnsafeUrlError(`无法连接 ${url.hostname}`);
    }
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || hop >= MAX_REDIRECTS) throw new UnsafeUrlError("链接跳转过多");
      checked = await checkUrl(new URL(location, url).toString(), lookup);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new UnsafeUrlError(`${url.hostname} 返回错误（HTTP ${response.status}）`);
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > options.maxBytes) {
      await response.body?.cancel();
      throw new UnsafeUrlError(`图片超过 ${Math.round(options.maxBytes / 1024 / 1024)} MB`);
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new UnsafeUrlError("链接没有内容");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > options.maxBytes) {
        await reader.cancel();
        throw new UnsafeUrlError(`图片超过 ${Math.round(options.maxBytes / 1024 / 1024)} MB`);
      }
      chunks.push(value);
    }
    return {
      data: Buffer.concat(chunks),
      url: url.toString(),
      contentType: response.headers.get("content-type")
    };
  }
}
