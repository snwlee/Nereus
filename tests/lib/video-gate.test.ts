import { describe, it, expect } from "vitest";
import { videoGateVerdict, findPaidMarker, scriptTargets, effectiveCwd, VIDEO_GATE_DEFAULTS } from "../../plugins/nereus/hooks/scripts/lib/video-gate.mjs";

const OM = "/Users/u/OpenMontage";
const files: Record<string, string> = {
  "/p/scripts/gen_i2v.py": "import higgsfield_client as hf\nhf.subscribe('kling', arguments={})",
  "/p/scripts/build.py": "import subprocess  # ffmpeg only",
  "/n/plugins/nereus/skills/image/scripts/muapi-cli.mjs": "const BASE='https://api.muapi.ai/api/v1'",
};
const base = (over: any = {}) => ({
  cwd: "/p",
  readFile: (p: string) => { if (p in files) return files[p]; throw new Error("ENOENT"); },
  isOpenMontage: (dir: string) => dir === OM || dir.startsWith(OM + "/"),
  override: null as string | null,
    config: VIDEO_GATE_DEFAULTS,
  ...over,
});

describe("findPaidMarker", () => {
  it("유료 생성 API 흔적을 찾는다", () => {
    expect(findPaidMarker("python -c 'import higgsfield_client'")).toBeTruthy();
    expect(findPaidMarker("curl https://queue.fal.run/fal-ai/kling")).toBeTruthy();
    expect(findPaidMarker("curl -H x-api-key https://api.muapi.ai/api/v1/x")).toBeTruthy();
    expect(findPaidMarker("ffmpeg -i a.mp4 b.mp4")).toBeNull();
    expect(findPaidMarker("npx hyperframes render")).toBeNull();
  });
});

describe("scriptTargets / effectiveCwd", () => {
  it("실행되는 스크립트 경로를 cd 를 반영해 푼다", () => {
    expect(effectiveCwd("cd /q && python x.py", "/p")).toBe("/q");
    expect(scriptTargets("cd /p && ./.venv/bin/python scripts/gen_i2v.py a b", "/x")).toEqual(["/p/scripts/gen_i2v.py"]);
    expect(scriptTargets("node /n/plugins/nereus/skills/image/scripts/muapi-cli.mjs generate --x", "/p")).toEqual(["/n/plugins/nereus/skills/image/scripts/muapi-cli.mjs"]);
  });
});

describe("videoGateVerdict", () => {
  it("유료 API 를 부르지 않는 명령은 통과한다", () => {
    expect(videoGateVerdict({ command: "python3 scripts/build.py", ...base() }).allow).toBe(true);
    expect(videoGateVerdict({ command: "ffmpeg -i a b", ...base() }).allow).toBe(true);
  });
  it("유료 API 를 부르는 배치 스크립트는 OpenMontage 밖에서 막는다", () => {
    const v = videoGateVerdict({ command: "python3 scripts/gen_i2v.py P1", ...base() });
    expect(v.allow).toBe(false);
    expect(v.reason).toContain("OpenMontage");
  });
  it("OpenMontage 안에서는 통과한다", () => {
    expect(videoGateVerdict({ command: "python tools/video/higgsfield_video.py", ...base({ cwd: OM }) }).allow).toBe(true);
    expect(videoGateVerdict({ command: `cd ${OM} && python -c 'import higgsfield_client'`, ...base() }).allow).toBe(true);
  });
  it("단발 호출은 배치가 아니라고 표시하고, 예산 판정은 호출부에 맡긴다", () => {
    const cmd = "node /n/plugins/nereus/skills/image/scripts/muapi-cli.mjs generate --capability t2v --prompt x";
    const v = videoGateVerdict({ command: cmd, ...base() });
    expect(v.allow).toBe(true);
    expect(v.paid).toBe(true);
    expect(v.batch).toBe(false);
  });
  it("OpenMontage 안의 유료 배치는 통과하되 예산 판정 대상으로 표시한다", () => {
    const v = videoGateVerdict({ command: `cd ${OM} && python -c 'import higgsfield_client'`, ...base() });
    expect(v.allow).toBe(true);
    expect(v.paid).toBe(true);
  });
  it("muapi-cli 의 조회 명령(summary·models)은 유료 호출이 아니다", () => {
    expect(videoGateVerdict({ command: "node /n/plugins/nereus/skills/image/scripts/muapi-cli.mjs models t2v", ...base() }).allow).toBe(true);
  });
  it("사용자 승인 오버라이드가 있으면 한 번 통과시키고 소비한다", () => {
    const v = videoGateVerdict({ command: "python3 scripts/gen_i2v.py", ...base({ override: "사용자가 3컷 재생성 승인" }) });
    expect(v.allow).toBe(true);
    expect(v.consumeOverride).toBe(true);
  });
  it("enforce 가 off 면 검사하지 않고, warn 이면 통과시키되 경고한다", () => {
    expect(videoGateVerdict({ command: "python3 scripts/gen_i2v.py", ...base({ config: { ...VIDEO_GATE_DEFAULTS, enforce: "off" } }) }).allow).toBe(true);
    const w = videoGateVerdict({ command: "python3 scripts/gen_i2v.py", ...base({ config: { ...VIDEO_GATE_DEFAULTS, enforce: "warn" } }) });
    expect(w.allow).toBe(true);
    expect(w.warning).toContain("OpenMontage");
  });
});
