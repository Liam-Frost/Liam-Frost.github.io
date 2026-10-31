import { BlockList, isIP } from "node:net";

function normalize(ip: string) {
  // IPv4 clients on a dual-stack socket show up as ::ffff:1.2.3.4
  return ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
}

function family(ip: string) {
  return isIP(ip) === 6 ? "ipv6" : "ipv4";
}

/** A set of IP addresses and CIDR ranges (IPv4 and IPv6). An empty list allows nothing on its own; callers decide. */
export class IpList {
  private readonly list = new BlockList();
  readonly size: number;

  constructor(entries: string[]) {
    for (const entry of entries) {
      const [address, bits, extra] = entry.split("/");
      const base = normalize(address ?? "");
      if (extra !== undefined || !isIP(base)) {
        throw new Error(`"${entry}" is not an IP address or CIDR range`);
      }

      if (bits === undefined) {
        this.list.addAddress(base, family(base));
        continue;
      }

      const prefix = Number(bits);
      const max = isIP(base) === 6 ? 128 : 32;
      if (!/^\d+$/.test(bits) || prefix > max) {
        throw new Error(`"${entry}" has an invalid prefix length`);
      }
      this.list.addSubnet(base, prefix, family(base));
    }
    this.size = entries.length;
  }

  has(ip: string): boolean {
    const value = normalize(ip);
    return isIP(value) > 0 && this.list.check(value, family(value));
  }
}
