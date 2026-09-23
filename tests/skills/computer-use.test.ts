import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { judge, HUMAN_ACTIVE_SECONDS } from "../../plugins/nereus/skills/computer-use/scripts/judge.mjs";
import { parseCuaPermissions, parseOrcaCapabilities, parseHidIdle, parseArgs } from "../../plugins/nereus/skills/computer-use/scripts/probe.mjs";

const fixture = (name: string) => readFileSync(`tests/fixtures/computer-use/${name}`, "utf8");

// 실측 기준 probe: 이 맥(2026-09-24) — cua 0.28.2 설치, orca computer-use 동작.
const probeAll = (over = {}) => ({
  platform: "darwin",
  cua: { installed: true, permissions: { accessibility: "granted", screenRecording: "granted" } },
  orca: { installed: true, click: true, screenshot: true, dialogs: false },
  lume: { installed: false },
  humanIdleSeconds: 600,
  ...over,
});
const safeInput = { risk: "input", targetConfirmed: true, remoteControl: false };

describe("judge — 통로", () => {
  it("Cua 권한 완비면 cua", () => {
    expect(judge(probeAll(), safeInput).layer).toBe("cua");
  });

  it("Cua 권한 미확인이면 orca 로 내려가고 사유를 싣는다", () => {
    const r = judge(probeAll({ cua: { installed: true, permissions: { accessibility: "unknown", screenRecording: "unknown" } } }), safeInput);
    expect(r.layer).toBe("orca");
    expect(r.reasons).toContain("cua-permission-unconfirmed");
  });

  it("Cua 미설치·Orca 클릭 불가·스크린샷만 있으면 vision", () => {
    const r = judge(probeAll({ cua: { installed: false }, orca: { installed: true, click: false, screenshot: true, dialogs: false } }), safeInput);
    expect(r.layer).toBe("vision");
    expect(r.reasons).toEqual(expect.arrayContaining(["cua-missing", "orca-no-click"]));
  });

  it("아무 통로도 없으면 none", () => {
    const r = judge(probeAll({ cua: { installed: false }, orca: { installed: false } }), safeInput);
    expect(r.layer).toBe("none");
    expect(r.verdict).toBe("block");
  });

  it("격리 요구인데 Lume 없으면 none + ask + lume-missing", () => {
    const r = judge(probeAll(), { ...safeInput, needsIsolation: true });
    expect(r.layer).toBe("none");
    expect(r.verdict).toBe("ask");
    expect(r.reasons).toContain("lume-missing");
  });

  it("격리 요구이고 Lume 있으면 lume", () => {
    expect(judge(probeAll({ lume: { installed: true } }), { ...safeInput, needsIsolation: true }).layer).toBe("lume");
  });

  it("Orca 는 대화상자를 못 보므로 dialog 대상이면 비전 보조를 알린다", () => {
    const r = judge(probeAll({ cua: { installed: false } }), { ...safeInput, targetKind: "dialog" });
    expect(r.layer).toBe("orca");
    expect(r.reasons).toContain("orca-no-dialogs-use-vision");
  });
});

describe("judge — 안전", () => {
  it("원격 제어 중 입력은 block", () => {
    const r = judge(probeAll(), { ...safeInput, remoteControl: true });
    expect(r.verdict).toBe("block");
    expect(r.reasons).toContain("remote-control-active");
  });

  it("사람이 방금 입력했으면 block", () => {
    const r = judge(probeAll({ humanIdleSeconds: 5 }), safeInput);
    expect(r.verdict).toBe("block");
    expect(r.reasons).toContain("human-active");
  });

  it("유휴 시간이 임계 이상이면 막지 않는다", () => {
    expect(judge(probeAll({ humanIdleSeconds: HUMAN_ACTIVE_SECONDS }), safeInput).verdict).toBe("go");
  });

  it("대상 창 미확인 입력은 block", () => {
    const r = judge(probeAll(), { ...safeInput, targetConfirmed: false });
    expect(r.verdict).toBe("block");
    expect(r.reasons).toContain("target-unconfirmed");
  });

  it("되돌리기 어려운 행동은 승인 없으면 ask", () => {
    const r = judge(probeAll(), { ...safeInput, risk: "irreversible" });
    expect(r.verdict).toBe("ask");
    expect(r.reasons).toContain("needs-approval");
  });

  it("승인된 되돌리기 어려운 행동은 go", () => {
    expect(judge(probeAll(), { ...safeInput, risk: "irreversible", approved: true }).verdict).toBe("go");
  });

  it("읽기는 원격 제어 중에도 막지 않는다", () => {
    expect(judge(probeAll({ humanIdleSeconds: 1 }), { risk: "read", remoteControl: true }).verdict).toBe("go");
  });

  it("알 수 없는 risk 는 가장 엄한 irreversible 로 본다", () => {
    const r = judge(probeAll(), { ...safeInput, risk: "whatever" });
    expect(r.verdict).toBe("ask");
    expect(r.reasons).toContain("risk-unknown");
  });
});

// 픽스처는 전부 이 맥에서 실측 캡처한 출력이다(2026-09-24). 하네스가 만든 형식이 아니다.
describe("probe 파서 — 실측 출력", () => {
  it("Cua 데몬 없음은 두 권한 모두 unknown", () => {
    expect(parseCuaPermissions(fixture("cua-permissions-no-daemon.json"))).toEqual({ accessibility: "unknown", screenRecording: "unknown" });
  });

  it("깨진 출력도 unknown — granted 로도 denied 로도 단정하지 않는다", () => {
    expect(parseCuaPermissions("error: socket")).toEqual({ accessibility: "unknown", screenRecording: "unknown" });
  });

  it("Orca 는 클릭·스크린샷 가능, 대화상자 불가", () => {
    expect(parseOrcaCapabilities(fixture("orca-capabilities.json"))).toEqual({ installed: true, click: true, screenshot: true, dialogs: false });
  });

  it("Orca 출력이 ok 가 아니면 설치 안 된 것으로 본다", () => {
    expect(parseOrcaCapabilities('{"ok": false}').installed).toBe(false);
  });

  it("ioreg HIDIdleTime(ns)을 초로 바꾼다", () => {
    expect(parseHidIdle(fixture("ioreg-hid-idle.txt"))).toBeCloseTo(536.19, 1);
  });

  it("HIDIdleTime 이 없으면 null", () => {
    expect(parseHidIdle("nothing here")).toBeNull();
  });
});

describe("probe 인자", () => {
  it("기본은 read, 플래그를 켠다", () => {
    expect(parseArgs([])).toMatchObject({ risk: "read", targetConfirmed: false, remoteControl: false });
    expect(parseArgs(["--risk", "irreversible", "--target-confirmed", "--remote", "--approved", "--isolation", "--target-kind", "dialog"]))
      .toEqual({ risk: "irreversible", targetConfirmed: true, remoteControl: true, approved: true, needsIsolation: true, targetKind: "dialog" });
  });
});
