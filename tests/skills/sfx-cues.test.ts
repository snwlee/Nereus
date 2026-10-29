import { describe, it, expect } from "vitest";
import { parseCues, delayMs } from "../../plugins/nereus/skills/sfx/scripts/cues.mjs";

describe("sfx.cues", () => {
  it("정렬과 오류", () => {
    const r = parseCues([{ t: 2, id: "click/soft" }, { t: -1, id: "pop/a" }, { t: 0.5, file: "a.wav" }, { t: 1 }, { t: 3, url: "http://x" }]);
    expect(r.cues.map((c) => c.t)).toEqual([0.5, 2]);
    expect(r.errors.map((e) => e.index)).toEqual([1, 3, 4]);
  });
  it("소스는 정확히 하나", () => {
    expect(parseCues([{ t: 1, id: "a/b", file: "x.wav" }]).errors).toHaveLength(1);
  });
  it("gainDb 기본 0, -40~+6 로 자름, 메타 보존", () => {
    const r = parseCues([{ t: 1, id: "a/b", gainDb: 20 }, { t: 2, url: "https://x/y.mp3", gainDb: -99, license: "cc0", attribution: "A", source: "freesound", apex: 0.1 }, { t: 3, id: "c/d" }]);
    expect(r.cues.map((c) => c.gainDb)).toEqual([6, -40, 0]);
    expect(r.cues[1]).toMatchObject({ license: "cc0", attribution: "A", source: "freesound", apex: 0.1 });
  });
  it("배열이 아니면 오류", () => {
    expect(parseCues({} as unknown as unknown[]).errors[0].reason).toMatch(/array/);
  });
  it("정점 정렬", () => {
    expect(delayMs(1.0, 0.042)).toBe(958);
    expect(delayMs(0.01, 0.13)).toBe(0);
  });
  it("apex·dur 는 0 이상 숫자여야 한다", () => {
    const r = parseCues([{ t: 1, id: "a/b", apex: "x" }, { t: 2, id: "a/b", dur: -1 }, { t: 3, id: "a/b", apex: 0.1, dur: 0.5 }]);
    expect(r.errors.map((e) => e.index)).toEqual([0, 1]);
    expect(r.cues).toHaveLength(1);
  });
  it("내부 주소 url 은 거부한다", () => {
    const bad = ["https://localhost/a.mp3", "https://127.0.0.1/a.mp3", "https://10.0.0.5/a.mp3", "https://192.168.1.2/a.mp3", "https://172.16.0.1/a.mp3", "https://169.254.169.254/latest", "https://[::1]/a.mp3", "https://printer.local/a.mp3"];
    const r = parseCues(bad.map((url, i) => ({ t: i, url, license: "cc0" })));
    expect(r.errors).toHaveLength(bad.length);
    expect(parseCues([{ t: 0, url: "https://cdn.freesound.org/previews/1/1.mp3", license: "cc0" }]).errors).toHaveLength(0);
  });
  it("pitch 는 음이름, seed 는 0 이상 정수", () => {
    const r = parseCues([{ t: 0, id: "a/b", pitch: "--dur" }, { t: 1, id: "a/b", seed: 1.5 }, { t: 2, id: "a/b", pitch: "F#7", seed: 7 }, { t: 3, id: "a/b", pitch: "Eb4" }]);
    expect(r.errors.map((e) => e.index)).toEqual([0, 1]);
    expect(r.cues).toHaveLength(2);
  });
});
