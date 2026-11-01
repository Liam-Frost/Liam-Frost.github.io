import type { FastifyRequest } from "fastify";
import maxmind, { type CountryResponse, type Reader } from "maxmind";

/** Country codes a proxy uses for "unknown" and Tor rather than a country. */
const NOT_COUNTRIES = new Set(["XX", "T1", "ZZ"]);

export type CountryLookup = {
  readonly source: "header" | "geoip" | "none";
  /** The visitor's two-letter country code, or null. The IP is only used here, never stored. */
  country(request: FastifyRequest): Promise<string | null>;
};

/**
 * Countries from a trusted proxy's header (e.g. Cloudflare's cf-ipcountry), or else from a local GeoLite2
 * Country database. The header is only safe behind a proxy that sets it on every request.
 */
export function createCountryLookup(
  options: { header: string | null; geoipDb: string | null },
  onError: (error: unknown) => void = () => {}
): CountryLookup {
  if (options.header) {
    const header = options.header;
    return {
      source: "header",
      async country(request) {
        const value = request.headers[header];
        const code = (Array.isArray(value) ? value[0] : value)?.trim().toUpperCase();
        return code && /^[A-Z]{2}$/.test(code) && !NOT_COUNTRIES.has(code) ? code : null;
      }
    };
  }
  if (options.geoipDb) {
    const path = options.geoipDb;
    let reader: Promise<Reader<CountryResponse> | null> | null = null;
    return {
      source: "geoip",
      async country(request) {
        // Opened on first use; a missing or broken file is reported once and leaves countries unknown.
        reader ??= maxmind.open<CountryResponse>(path).catch((error: unknown) => {
          onError(error);
          return null;
        });
        const lookup = await reader;
        try {
          return lookup?.get(request.ip)?.country?.iso_code ?? null;
        } catch {
          return null;
        }
      }
    };
  }
  return { source: "none", country: async () => null };
}
