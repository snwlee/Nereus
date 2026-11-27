import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

// 2026-09-22: 75KB diff 를 한 번에 넣었더니 Gemini 가 빈 응답을 돌려줬고 ask 는 exit 0 으로 끝났다.
// 호출자(review·design)는 exit 0 을 "응답 있음"으로 읽는다 — 빈 응답은 실패로 내보내야 한다.
const DIR = path.resolve(__dirname, "../../plugins/nereus/skills/image/scripts");

function emit(text: string | null) {
  const code = `import sys; sys.path.insert(0, ${JSON.stringify(DIR)}); import gemini_cli; raise SystemExit(gemini_cli.emit_answer(${JSON.stringify(text)} if ${text !== null ? "True" : "False"} else None))`;
  // Windows 의 Python 표준 스트림은 cp1252 라 한글이 \uXXXX 로 이스케이프된다 — UTF-8 로 고정한다.
  return spawnSync("python3", ["-c", code], { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
}

// 파이썬 첫 기동(모듈 컴파일 포함)이 Windows 러너에서는 10초를 넘긴다.
describe("gemini_cli ask — 빈 응답은 실패다", { timeout: 30_000 }, () => {
  it("응답이 있으면 출력하고 0", () => {
    const r = emit("VERDICT: OK");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("VERDICT: OK");
  });
  it("빈 응답·공백·None 은 stderr 에 이유를 남기고 1", () => {
    for (const t of ["", "  \n ", null]) {
      const r = emit(t);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/빈 응답/);
    }
  });
});
