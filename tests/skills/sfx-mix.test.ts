import { describe, it, expect } from "vitest";
import { buildMixArgs } from "../../plugins/nereus/skills/sfx/scripts/mix.mjs";

const fc = (a: string[]) => a[a.indexOf("-filter_complex") + 1];
const tracks = [{ file: "a.wav", delayMs: 958, gainDb: 0 }, { file: "b.wav", delayMs: 0, gainDb: -6 }];

describe("sfx.mix", () => {
  it("원본 오디오 포함", () => {
    const a = buildMixArgs({ video: "in.mp4", out: "out.mp4", tracks, hasAudio: true });
    expect(fc(a)).toContain("[0:a]");
    expect(fc(a)).toContain("amix=inputs=3");
    expect(fc(a)).toContain("normalize=0");
    expect(fc(a)).toContain("duration=first");
    expect(fc(a)).toContain("adelay=958:all=1");
    expect(fc(a)).toContain("volume=-6dB");
    expect(a.join(" ")).toContain("-c:v copy");
    expect(a).not.toContain("-shortest");
    expect(a.at(-1)).toBe("file:out.mp4");
  });
  it("무음 영상", () => {
    const a = buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks: [tracks[0]], hasAudio: false });
    expect(fc(a)).not.toContain("[0:a]");
    expect(fc(a)).toContain("amix=inputs=1");
    expect(fc(a)).toContain("duration=longest");
  });
  it("입력 순서", () => {
    const a = buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks, hasAudio: true });
    const inputs = a.flatMap((x, i) => (x === "-i" ? [a[i + 1]] : []));
    expect(inputs).toEqual(["file:in.mp4", "file:a.wav", "file:b.wav"]);
  });
  it("트랙이 없으면 throw", () => {
    expect(() => buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks: [], hasAudio: true })).toThrow();
  });
  it("숫자가 아닌 delayMs·gainDb 는 거부한다 (filter 주입 방지)", () => {
    expect(() => buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks: [{ file: "a.wav", delayMs: 0, gainDb: "0dB[x];amovie=/etc/passwd" as unknown as number }], hasAudio: false })).toThrow(/gainDb/);
    expect(() => buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks: [{ file: "a.wav", delayMs: "1;x" as unknown as number, gainDb: 0 }], hasAudio: false })).toThrow(/delayMs/);
  });
  it("모든 입력에 file 프로토콜만 허용한다 (concat:·http:·m3u8 경유 차단)", () => {
    const a = buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks, hasAudio: true });
    const before = a.flatMap((x, i) => (x === "-i" ? [a.slice(i - 2, i).join(" ")] : []));
    expect(before).toEqual(Array(3).fill("-protocol_whitelist file"));
    expect(a.at(-1)).toBe("file:o.mp4");
  });
});
