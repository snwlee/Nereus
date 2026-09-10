// 외부 스킬 설치 게이트. skillspector scan --json 결과를 판정한다.
// 사용: node scan-gate.mjs < report.json  (또는 import { scanGate })
//
// scanGate(report) -> { install: boolean, blocking: object[], warnings: object[] }
// - severity critical/high → blocking, install:false
// - 그 외(medium/low/info/unknown) → warnings, install:true
// - findings 없음 → install:true
// - malformed(비객체, findings 누락/비배열) → fail-closed, install:false
// stdlib only. child_process, network 사용 금지.

const BLOCKING = new Set(["critical", "high"]);

function malformed(reason) {
  return { install: false, blocking: [{ severity: "unknown", id: "malformed-report", message: reason }], warnings: [] };
}

export function scanGate(report) {
  if (report === null || report === undefined) return malformed("empty report: null or undefined");
  if (typeof report !== "object") return malformed(`invalid report type: ${typeof report}`);
  const findings = Array.isArray(report) ? report : report.findings;
  if (!Array.isArray(findings)) return malformed("missing findings array");
  const blocking = [];
  const warnings = [];
  for (const f of findings) {
    const sev = typeof f?.severity === "string" ? f.severity.toLowerCase() : "";
    if (BLOCKING.has(sev)) blocking.push(f);
    else warnings.push(f);
  }
  return { install: blocking.length === 0, blocking, warnings };
}
