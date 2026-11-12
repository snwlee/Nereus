import { describe, it, expect } from "vitest";
import {
  validateRecipe,
  parseRunResult,
  runGate,
  recipePath,
} from "../../plugins/nereus/skills/computer-use/scripts/steps.mjs";

// 출처: milind-soni/OpenMausBot server/saved-steps (Apache-2.0) — 성공한 조작을 저장해 LLM 없이 재실행하고,
// 깨지면 에이전트에게 돌려준다. 실행 기반은 cua-driver run_script({role,name} 대상을 매번 새로 찾는다).

const ok = { name: "save-report", app: "notepad.exe", script: 'const a = await cua.getApp("notepad.exe"); return {ok: true};' };

describe("validateRecipe", () => {
  it("정상 레시피는 오류가 없다", () => {
    expect(validateRecipe(ok)).toEqual([]);
  });
  it("이름은 파일명으로 안전한 kebab-case 만", () => {
    expect(validateRecipe({ ...ok, name: "../evil" }).length).toBeGreaterThan(0);
    expect(validateRecipe({ ...ok, name: "Save Report" }).length).toBeGreaterThan(0);
  });
  it("스냅샷에 묶인 element_token 을 박아 두면 거절한다 — 다음 실행에서 이미 무효다", () => {
    const s = 'await (await cua.getApp("x")).click("s0000002a:11"); return {ok: true};';
    expect(validateRecipe({ ...ok, script: s }).join(" ")).toMatch(/token/);
  });
  it("검증 결과를 return {ok} 로 내지 않으면 거절한다 — run_script 의 ok 는 호출 성공일 뿐이다", () => {
    expect(validateRecipe({ ...ok, script: 'await cua.getApp("x");' }).join(" ")).toMatch(/return/);
  });
  it("run_script 한도(64KiB)를 넘으면 거절한다", () => {
    expect(validateRecipe({ ...ok, script: "x".repeat(65537) + " return {ok: true};" }).length).toBeGreaterThan(0);
  });
  it("app 이 없으면 거절한다 — 어느 창을 건드리는지 모르는 레시피는 저장하지 않는다", () => {
    expect(validateRecipe({ ...ok, app: "" }).length).toBeGreaterThan(0);
  });
});

describe("parseRunResult", () => {
  const rpc = (structured: unknown) => ({ jsonrpc: "2.0", id: 2, result: { content: [], structuredContent: structured } });
  it("스크립트가 {ok:true} 를 돌려주면 통과", () => {
    expect(parseRunResult(rpc({ ok: true, value: { ok: true, saved: 1 }, elapsed_ms: 900, driver_calls: 3 }))).toMatchObject({ ok: true, ms: 900, calls: 3 });
  });
  it("호출은 성공했어도 검증 값이 ok 가 아니면 실패 — 실측: 입력이 안 들어갔는데 run_script 는 ok 였다", () => {
    const r = parseRunResult(rpc({ ok: true, value: { found: 0 }, elapsed_ms: 5497, driver_calls: 4 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/검증/);
  });
  it("드라이버 오류면 실패와 이유", () => {
    const r = parseRunResult(rpc({ ok: false, error: "element not found: button Save", calls: [] }));
    expect(r).toMatchObject({ ok: false });
    expect(r.reason).toContain("element not found");
  });
  it("드라이버 오류가 객체면 message 를 이유로 쓴다 — 실측 0.47.13 형식", () => {
    const r = parseRunResult(rpc({ ok: false, error: { call: 2, code: "window_not_found", kind: "exception", line: 1, message: "get_app failed: no window for pid 39584", op: "get_app" } }));
    expect(r.reason).toContain("get_app failed: no window for pid 39584");
    expect(r.reason).not.toContain("[object Object]");
  });
  it("JSON-RPC 오류·빈 응답도 실패로 읽는다", () => {
    expect(parseRunResult({ jsonrpc: "2.0", id: 2, error: { code: -32602, message: "bad args" } }).ok).toBe(false);
    expect(parseRunResult(null).ok).toBe(false);
  });
});

describe("runGate", () => {
  it("되돌리기 어려운 레시피는 승인 없이는 실행하지 않는다", () => {
    expect(runGate({ ...ok, irreversible: true }, { approved: false })).toMatchObject({ allow: false });
    expect(runGate({ ...ok, irreversible: true }, { approved: true })).toMatchObject({ allow: true });
  });
  it("보통 레시피는 실행한다", () => {
    expect(runGate(ok, { approved: false })).toMatchObject({ allow: true });
  });
  it("최근 실행이 연속 2번 실패한 레시피는 막는다 — 앱이 바뀌었다는 신호다", () => {
    const runs = [{ ok: true }, { ok: false }, { ok: false }];
    expect(runGate({ ...ok, runs }, { approved: true })).toMatchObject({ allow: false });
  });
});

describe("recipePath", () => {
  it("프로젝트 .nereus/saved-steps/<이름>.json", () => {
    expect(recipePath("/proj", "save-report").replace(/\\/g, "/")).toBe("/proj/.nereus/saved-steps/save-report.json");
  });
});
