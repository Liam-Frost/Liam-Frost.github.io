/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  audioVisualization,
  createAudioTap,
  observeSpotifyEmbed
} from "../../web/src/data/audio-visualization";
import { gaussian, sectionAt, syntheticEnergy } from "../../web/src/components/waveform/model";

afterEach(() => vi.unstubAllGlobals());

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
    for (let i = 0; i < 32; i++) expect(syntheticEnergy(i * 30, i)).toBeGreaterThanOrEqual(0);
    expect(syntheticEnergy(1, 0)).not.toBe(syntheticEnergy(1, 1));
  });
});

describe("audio capture tap", () => {
  it("keeps a plain Spotify embed unknown and clears it on unmount", () => {
    const dispose = observeSpotifyEmbed();
    expect(audioVisualization.get()).toMatchObject({
      source: "spotify",
      playback: "unknown",
      playing: false,
      analyser: null
    });
    dispose();
    expect(audioVisualization.get()).toMatchObject({ source: "none", playback: "stopped" });
  });
  it("analyses captured audio without connecting any node to the speaker", () => {
    const audio = new EventTarget() as HTMLAudioElement & { captureStream: () => MediaStream };
    const stop = vi.fn(),
      disconnect = vi.fn(),
      connect = vi.fn(),
      close = vi.fn().mockResolvedValue(undefined);
    const analyser = { fftSize: 0, smoothingTimeConstant: 0, disconnect };
    const source = { connect, disconnect };
    const capture = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    audio.captureStream = () => capture;
    const context = {
      resume: vi.fn().mockResolvedValue(undefined),
      suspend: vi.fn().mockResolvedValue(undefined),
      close,
      createMediaStreamSource: vi.fn().mockReturnValue(source),
      createAnalyser: vi.fn().mockReturnValue(analyser)
    };
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return context;
      })
    );
    const tap = createAudioTap(audio);
    audio.dispatchEvent(new Event("playing"));
    expect(audioVisualization.get()).toMatchObject({ source: "custom", playing: true, analyser });
    expect(connect).toHaveBeenCalledExactlyOnceWith(analyser);
    audio.dispatchEvent(new Event("pause"));
    expect(audioVisualization.get().playing).toBe(false);
    tap.dispose();
    expect(stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(audioVisualization.get().source).toBe("none");
  });
  it("keeps playback state usable when capture is unsupported or throws", () => {
    const audio = new EventTarget() as HTMLAudioElement;
    const tap = createAudioTap(audio);
    audio.dispatchEvent(new Event("playing"));
    expect(audioVisualization.get()).toMatchObject({
      source: "custom",
      playing: true,
      analyser: null
    });
    audio.dispatchEvent(new Event("ended"));
    expect(audioVisualization.get().playing).toBe(false);
    tap.dispose();
  });
});
