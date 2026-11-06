/** Only the current opaque child may deliver state; the nonce rejects stale or forged frames. */
export function trustedSpotifyMessage(
  event: MessageEvent,
  child: MessageEventSource | null,
  token: string
) {
  if (!child || event.source !== child || event.origin !== "null") return false;
  const data: unknown = event.data;
  if (!data || typeof data !== "object") return false;
  const value = data as { channel?: unknown; type?: unknown; token?: unknown };
  return value.channel === "lf-spotify-bridge" && (value.type === "hello" || value.token === token);
}
