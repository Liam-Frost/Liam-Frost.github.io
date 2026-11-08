/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "../../web/src/lib/analytics";
import { sendPlayerCommand, type PlayRequest } from "../../web/src/data/playerBus";

vi.mock("../../web/src/lib/analytics", () => ({ track: vi.fn() }));
const song = (id: string, previewUrl = "", spotifyUrl: string | null = null): PlayRequest => ({
  id,
  title: id,
  artist: "Artist",
  image: "",
  link: "",
  previewUrl,
  spotifyUrl
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("page play requests", () => {
  it("counts explicit song requests before playback, never a pause", () => {
    vi.stubGlobal("window", new EventTarget());
    sendPlayerCommand({
      type: "play",
      track: song("one", "", "https://open.spotify.com/track/one"),
      player: "spotify"
    });
    expect(track).toHaveBeenCalledExactlyOnceWith("music_request", {
      contentId: "one",
      target: "spotify",
      detail: "button"
    });
    sendPlayerCommand({ type: "pause" });
    expect(track).toHaveBeenCalledTimes(1);
  });
  it("counts play-all once for the first playable song in the chosen player", () => {
    vi.stubGlobal("window", new EventTarget());
    const tracks = [
      song("none"),
      song("spotify", "", "https://open.spotify.com/track/song"),
      song("preview", "https://example.com/preview.mp3")
    ];
    sendPlayerCommand({ type: "queue", tracks, spotifyUrl: null, player: "site" });
    expect(track).toHaveBeenLastCalledWith("music_request", {
      contentId: "preview",
      target: "site",
      detail: "all"
    });
    sendPlayerCommand({ type: "queue", tracks, spotifyUrl: null, player: "spotify" });
    expect(track).toHaveBeenLastCalledWith("music_request", {
      contentId: "spotify",
      target: "spotify",
      detail: "all"
    });
    sendPlayerCommand({ type: "queue", tracks: [], spotifyUrl: null, player: "site" });
    expect(track).toHaveBeenCalledTimes(2);
  });
});
