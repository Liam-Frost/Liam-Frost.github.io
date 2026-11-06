/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  audioVisualization,
  observeAudioPlayback,
  observeSpotifyEmbed
} from "../../web/src/data/audio-visualization";
import {
  gaussian,
  HOVER_PEAK,
  PLAYING_AMPLITUDE,
  sectionAt,
  syntheticEnergy
} from "../../web/src/components/waveform/model";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("section navigation mapping", () => {
  const sections = [
    { id: "one", title: "One", summary: "", top: 100, bottom: 650 },
    { id: "two", title: "Two", summary: "", top: 650, bottom: 2800 },
    { id: "three", title: "Three", summary: "", top: 2800, bottom: 3000 }
  ];
  it("maps document positions to actual uneven section boundaries", () => {
    expect([0, 649, 650, 2799, 2800, 3000].map((y) => sectionAt(sections, y))).toEqual([
      0, 0, 1, 1, 2, 2
    ]);
    expect(sectionAt([], 0)).toBe(-1);
  });
  it("makes a symmetric Gaussian peak and a bounded, non-synchronized synthetic signal", () => {
    expect(gaussian(0)).toBe(1);
    expect(gaussian(-2)).toBe(gaussian(2));
    expect(gaussian(1)).toBeGreaterThan(gaussian(3));
    for (let i = 0; i < 32; i++) {
      expect(syntheticEnergy(i * 0.37, i % 18)).toBeGreaterThanOrEqual(0);
      expect(syntheticEnergy(i * 0.37, i % 18)).toBeLessThanOrEqual(1);
    }
    expect(syntheticEnergy(1, 0)).not.toBe(syntheticEnergy(1, 1));
  });
  it("moves visibly over time while staying below the hover peak", () => {
    const values = Array.from({ length: 60 }, (_, i) => syntheticEnergy(i / 30, 4));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.4);
    expect(PLAYING_AMPLITUDE * Math.max(...values)).toBeLessThan(HOVER_PEAK);
    expect(PLAYING_AMPLITUDE * (Math.max(...values) - Math.min(...values))).toBeGreaterThan(10);
  });
});

/** A window with message events and timers, for the Spotify embed's messages. */
function fakeWindow() {
  const win = Object.assign(new EventTarget(), {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id)
  });
  vi.stubGlobal("window", win);
  const frameWindow = {};
  const frame = { contentWindow: frameWindow } as unknown as HTMLIFrameElement;
  const post = (
    data: unknown,
    origin = "https://open.spotify.com",
    source: unknown = frameWindow
  ) => {
    const event = new Event("message");
    Object.assign(event, { data, origin, source });
    win.dispatchEvent(event);
  };
  return { frame, post };
}

describe("music playback for the visualizer", () => {
  it("follows the Spotify embed's own playback messages", () => {
    const { frame, post } = fakeWindow();
    const dispose = observeSpotifyEmbed(() => frame);
    expect(audioVisualization.get()).toEqual({ source: "spotify", playing: false });
    post({ type: "playback_started", payload: { playingURI: "spotify:track:x" } });
    expect(audioVisualization.get().playing).toBe(true);
    post({ type: "playback_update", payload: { isPaused: true, isBuffering: false } });
    expect(audioVisualization.get().playing).toBe(false);
    // Spotify may send the message as a JSON string.
    post(JSON.stringify({ type: "playback_update", payload: { isPaused: false } }));
    expect(audioVisualization.get().playing).toBe(true);
    dispose();
    expect(audioVisualization.get()).toEqual({ source: "none", playing: false });
  });
  it("ignores messages from other origins, other frames and other shapes", () => {
    const { frame, post } = fakeWindow();
    const dispose = observeSpotifyEmbed(() => frame);
    post({ type: "playback_started" }, "https://evil.example");
    post({ type: "playback_started" }, "https://open.spotify.com", {});
    post({ type: "playback_update", payload: { isPaused: "no" } });
    post("not json");
    expect(audioVisualization.get().playing).toBe(false);
    dispose();
  });
  it("counts as stopped when the embed goes quiet", () => {
    vi.useFakeTimers();
    const { frame, post } = fakeWindow();
    const dispose = observeSpotifyEmbed(() => frame);
    post({ type: "playback_update", payload: { isPaused: false } });
    vi.advanceTimersByTime(3000);
    post({ type: "playback_update", payload: { isPaused: false } });
    vi.advanceTimersByTime(3000);
    expect(audioVisualization.get().playing).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(audioVisualization.get().playing).toBe(false);
    dispose();
  });
  it("follows the site player's audio element", () => {
    const audio = new EventTarget() as HTMLAudioElement;
    const tap = observeAudioPlayback(audio);
    audio.dispatchEvent(new Event("playing"));
    expect(audioVisualization.get()).toEqual({ source: "custom", playing: true });
    audio.dispatchEvent(new Event("pause"));
    expect(audioVisualization.get().playing).toBe(false);
    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("ended"));
    expect(audioVisualization.get().playing).toBe(false);
    tap.dispose();
    expect(audioVisualization.get().source).toBe("none");
  });
});
