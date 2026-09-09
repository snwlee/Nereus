// 프롬프트 anti-pattern 검사. Anthropic 이 "프론티어 모델에서 역효과" 로 지목한 패턴만 본다.
// 출처: claude.com/blog/reducing-cost-and-improving-performance-with-claude-platform
// (측정: anti-pattern 제거 후 비용 -14.6%, 정확도 +5.3%)
//
// 이 검사의 목적은 **회귀 방지**다. 2026-09-10 실측에서 이 저장소는 이미 0건이었다.
// 앞으로 누가 "꼼꼼히 검토한다" 를 넣으면 CI 가 잡는다.
//
// 가장 중요한 설계 규칙: **게이트 규칙을 거짓양성으로 잡지 않는다.**
// "수정 전에 반드시 있어야 한다"(TDD PreToolUse 가 실제로 차단), "Gemini 피드백을 반드시 거친다"
// (design 하드 게이트)는 기계가 강제하는 사실의 서술이지, 모델을 더 열심히 굴리려는 수식어가 아니다.
// 그래서 "반드시·절대·전부" 같은 단어는 규칙에 넣지 않는다 — 넣으면 47건이 잡히고 전부 거짓양성이라
// 검사 자체가 무시된다.
//
// 사용:
//   node prompt-audit.mjs                    스킬 SKILL.md + 에이전트 전체
//   node prompt-audit.mjs <파일...>          지정한 파일만
import fs from "node:fs";
import path from "node:path";

// 전역 플래그를 쓰지 않는다 — lastIndex 상태가 남아 재사용 시 결과가 흔들린다.
export const RULES = Object.freeze([
  {
    id: "thoroughness-booster",
    re: /(꼼꼼히|철저히|빠짐없이|샅샅이|면밀히|최대한\s*자세히|가능한\s*한\s*많이|maximally\s+thorough|be\s+exhaustive|as\s+thorough\s+as\s+possible|very\s+carefully)/i,
    why: "프론티어 모델에는 효과가 없고 토큰만 쓴다. 무엇을 볼지 구체적으로 적는다",
  },
  {
    id: "verification-ritual",
    re: /(다시\s*한\s*번\s*확인|두\s*번\s*확인|세\s*번\s*확인|재확인하[고라세]|double[-\s]?check|triple[-\s]?check|verify\s+twice)/i,
    why: "검증 의식은 정확도를 올리지 않는다. 검증이 필요하면 기계 게이트로 만든다",
  },
  {
    id: "scratchpad-scaffolding",
    re: /(단계별로\s*생각|먼저\s*생각한\s*뒤|차근차근\s*생각|think\s+step[-\s]by[-\s]step|let'?s\s+think|사고\s*과정을\s*적)/i,
    why: "확장 사고가 기본인 모델에는 불필요한 발판이다",
  },
  {
    id: "dated-model",
    re: /\b(claude-[12]\b|claude-3[.\-]|claude-3\b|gpt-[34]\b|gpt-4[.\-]|haiku-3\b|sonnet-3\b)/i,
    why: "구식 모델 식별자. 최신 모델로 갱신한다",
  },
]);

/**
 * 코드 블록과 인라인 코드를 제거한다. 셸 예시나 플래그 이름은 프롬프트 지시가 아니다.
 * 줄 번호를 유지하려고 지운 줄을 빈 줄로 남긴다.
 */
function stripCode(lines) {
  const out = [];
  let fenced = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) { fenced = !fenced; out.push(""); continue; }
    out.push(fenced ? "" : line.replace(/`[^`]*`/g, " "));
  }
  return out;
}

export function auditText(text) {
  const lines = stripCode(String(text ?? "").split("\n"));
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    for (const rule of RULES) {
      if (!rule.re.test(lines[i])) continue;
      findings.push({ id: rule.id, line: i + 1, text: lines[i].trim().slice(0, 120), why: rule.why });
    }
  }
  return findings;
}

export function auditFiles(files, { readFile = (p) => fs.readFileSync(p, "utf8") } = {}) {
  const report = [];
  for (const file of files) {
    let text;
    try { text = readFile(file); } catch { continue; } // 한 파일 때문에 감사 전체를 멈추지 않는다
    const findings = auditText(text);
    if (findings.length) report.push({ file, findings });
  }
  return report;
}

export function formatReport(report, scanned) {
  if (!report.length) {
    return `## 프롬프트 anti-pattern 검사\n\n- 검사 대상 ${scanned}개 파일\n- 지적 0건 — 통과`;
  }
  const total = report.reduce((n, r) => n + r.findings.length, 0);
  const lines = ["## 프롬프트 anti-pattern 검사", "", `- 검사 대상 ${scanned}개 파일, 지적 ${total}건`, ""];
  for (const r of report) {
    lines.push(`### ${r.file}`);
    for (const f of r.findings) lines.push(`- ${f.file ?? ""}${f.line}행 [${f.id}] ${f.text}`, `  → ${f.why}`);
    lines.push("");
  }
  lines.push("출처: Anthropic 비용·성능 가이드(anti-pattern 제거 시 비용 -14.6%, 정확도 +5.3%)");
  return lines.join("\n");
}

export function exitCodeFor(report) {
  return report.length ? 1 : 0;
}

function defaultTargets(root) {
  const out = [];
  const skills = path.join(root, "plugins", "nereus", "skills");
  const agents = path.join(root, "plugins", "nereus", "agents");
  try {
    for (const d of fs.readdirSync(skills)) {
      const f = path.join(skills, d, "SKILL.md");
      if (fs.existsSync(f)) out.push(f);
    }
  } catch { /* 없으면 건너뛴다 */ }
  try {
    for (const f of fs.readdirSync(agents)) if (f.endsWith(".md")) out.push(path.join(agents, f));
  } catch { /* 없으면 건너뛴다 */ }
  return out;
}

if (process.argv[1] && /prompt-audit\.mjs$/.test(process.argv[1])) {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const files = args.length ? args : defaultTargets(root);
  const report = auditFiles(files).map((r) => ({ ...r, file: path.relative(root, r.file) }));
  process.stdout.write(formatReport(report, files.length) + "\n");
  process.exit(exitCodeFor(report));
}
