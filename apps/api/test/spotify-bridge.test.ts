/// <reference lib="dom" />
import { describe, expect, it } from "vitest";
import { trustedSpotifyMessage } from "../../web/src/data/spotify-bridge";

describe("Spotify bridge messages", () => {
  const child = {} as Window;
  const event = (data: unknown, source: MessageEventSource | null = child, origin = "null") =>
    ({ data, source, origin }) as MessageEvent;
  it("accepts the current opaque child's handshake and token-bound events", () => {
    expect(
      trustedSpotifyMessage(event({ channel: "lf-spotify-bridge", type: "hello" }), child, "secret")
    ).toBe(true);
    expect(
      trustedSpotifyMessage(
        event({ channel: "lf-spotify-bridge", type: "update", token: "secret" }),
        child,
        "secret"
      )
    ).toBe(true);
  });
  it("rejects other frames, non-opaque origins, stale tokens and invalid payloads", () => {
    const valid = { channel: "lf-spotify-bridge", type: "update", token: "secret" };
    expect(trustedSpotifyMessage(event(valid, {} as Window), child, "secret")).toBe(false);
    expect(trustedSpotifyMessage(event(valid, child, "https://example.com"), child, "secret")).toBe(
      false
    );
    expect(trustedSpotifyMessage(event({ ...valid, token: "old" }), child, "secret")).toBe(false);
    expect(trustedSpotifyMessage(event(null), child, "secret")).toBe(false);
  });
});
