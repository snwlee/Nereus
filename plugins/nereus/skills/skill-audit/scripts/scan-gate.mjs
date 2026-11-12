// 외부 스킬 설치 게이트. skillspector 보고서(JSON)를 판정한다.
// 보고서 만들기: skillspector scan <대상> --no-llm --format json --output report.json
//   (2.11 에는 `--json` 옵션이 없다 — 2026-11-12 실측)
// 판정: node scan-gate.mjs report.json   (또는 import { scanGate })
//   종료 코드 0 = 설치 가능, 1 = 차단. 표준 출력은 판정 JSON.
//
// scanGate(report) -> { install, blocking[], warnings[], incomplete }
// - 지적 목록은 `issues`(skillspector 2.x 실제 키). 이전 형식 `findings`·배열도 읽는다.
// - severity critical/high → blocking, install:false. 그 외 → warnings.
// - execution_successful === false → 스캔이 끝나지 않은 것이다. fail-closed.
// - analysis_completeness.is_complete === false → 통과는 시키되 incomplete 로 알린다.
//   참조를 못 푼 정도로도 partial 이 나온다(깨끗한 보안 문서도 그랬다) — 막으면 모든 설치가 막힌다.
// - malformed(비객체, 지적 목록 누락/비배열) → fail-closed.
// stdlib only. child_process, network 사용 금지.
import fs from "node:fs";

const BLOCKING = new Set(["critical", "high"]);

const blocked = (id, message) => ({ install: false, blocking: [{ severity: "unknown", id, message }], warnings: [], incomplete: true });
const malformed = (reason) => blocked("malformed-report", reason);

export function scanGate(report) {
  if (report === null || report === undefined) return malformed("empty report: null or undefined");
  if (typeof report !== "object") return malformed(`invalid report type: ${typeof report}`);
  const findings = Array.isArray(report) ? report : (report.issues ?? report.findings);
  if (!Array.isArray(findings)) return malformed("missing issues array");
  if (report.execution_successful === false) return blocked("scan-failed", "skillspector 실행이 끝까지 돌지 않았다 — 결과를 믿을 수 없다");
  const blocking = [];
  const warnings = [];
  for (const f of findings) {
    const sev = typeof f?.severity === "string" ? f.severity.toLowerCase() : "";
    if (BLOCKING.has(sev)) blocking.push(f);
    else warnings.push(f);
  }
  const incomplete = report.analysis_completeness?.is_complete === false;
  if (incomplete) {
    warnings.push({ severity: "info", id: "incomplete-analysis", message: `분석 완결성 ${report.analysis_completeness.status ?? "partial"} — 일부를 검사하지 못했다` });
  }
  return { install: blocking.length === 0, blocking, warnings, incomplete };
}

if (process.argv[1] && /scan-gate\.mjs$/.test(process.argv[1])) {
  let verdict;
  try {
    const raw = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : fs.readFileSync(0, "utf8");
    verdict = scanGate(JSON.parse(raw));
  } catch (e) {
    verdict = malformed(`보고서를 읽지 못함: ${e?.message ?? e}`);
  }
  process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
  process.exitCode = verdict.install ? 0 : 1;
}
