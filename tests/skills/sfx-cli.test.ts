import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

const CLI = join(process.cwd(), "plugins/nereus/skills/sfx/scripts/sfx-cli.mjs");
const HOME = process.env.NEREUS_SFXLITE ?? join(homedir(), ".local/share/nereus/sfx/earshot-sfx-lite");
const has = (c: string) => spawnSync(c, ["-version"]).status === 0;
const ready = has("ffmpeg") && has("ffprobe") && existsSync(join(HOME, "sfxlite"));
const run = (args: string[]) => spawnSync("node", [CLI, ...args], { encoding: "utf8", env: { ...process.env, NEREUS_SFXLITE: HOME } });
const dur = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));
const streams = (f: string) => execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f], { encoding: "utf8" });

describe("sfx-cli 입력 오류", () => {
  it("알 수 없는 명령은 1", () => {
    expect(run(["nope"]).status).toBe(1);
  });
  it("build 는 차단 라이선스 큐를 거부한다", () => {
    const d = mkdtempSync(join(tmpdir(), "sfx-"));
    writeFileSync(join(d, "cues.json"), JSON.stringify([{ t: 1, file: join(d, "x.wav"), license: "by-nc", attribution: "A" }]));
    const r = run(["build", join(d, "cues.json"), "--dir", join(d, "out")]);
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/blocked/);
  });
});

describe.skipIf(!ready)("sfx-cli 실제 믹스 [flow]", () => {
  let d = "";
  beforeAll(() => {
    d = mkdtempSync(join(tmpdir(), "sfx-"));
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", join(d, "in.mp4")]);
  });
  it("doctor 는 0", () => {
    const r = run(["doctor"]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).ok).toBe(true);
  });
  it("build → mix", () => {
    writeFileSync(join(d, "cues.json"), JSON.stringify([{ t: 1.0, id: "ui_pop/soft" }]));
    const b = run(["build", join(d, "cues.json"), "--dir", join(d, "sfx")]);
    expect(b.status, b.stderr).toBe(0);
    const plan = JSON.parse(readFileSync(join(d, "sfx", "sfx-plan.json"), "utf8"));
    expect(plan.tracks[0].delayMs).toBeGreaterThan(900);
    expect(readFileSync(join(d, "sfx", "SOUNDS.md"), "utf8")).toMatch(/ui_pop\/soft[\s\S]*synth/);
    const m = run(["mix", join(d, "in.mp4"), "--plan", join(d, "sfx", "sfx-plan.json"), "--out", join(d, "out.mp4")]);
    expect(m.status, m.stderr).toBe(0);
    expect(Math.abs(dur(join(d, "out.mp4")) - dur(join(d, "in.mp4")))).toBeLessThan(0.1);
    expect(streams(join(d, "out.mp4"))).toContain("audio");
  }, 60000);
});
