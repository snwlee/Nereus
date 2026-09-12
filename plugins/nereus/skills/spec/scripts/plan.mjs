// 규모 × 신규/수정 → 인터뷰·스펙 도구·역스펙·PRD. 결정 지점을 한 곳에 모은다.
// classify 는 손대지 않는다 — spec/SKILL.md 와 기존 테스트가 그 출력을 쓴다.
import { classify } from "./classify.mjs";

const SIZES = new Set(["small", "medium", "large"]);

const MATRIX = {
  "small:greenfield":  { interview: "none",  specTool: "tasks-only", reverseSpec: false, prd: false },
  "small:brownfield":  { interview: "none",  specTool: "tasks-only", reverseSpec: false, prd: false },
  "medium:greenfield": { interview: "short", specTool: "spec-kit",   reverseSpec: false, prd: false },
  // 기존 코드의 요구는 코드에 있다. 역스펙이 답하므로 인터뷰가 되묻지 않게 한다.
  "medium:brownfield": { interview: "none",  specTool: "openspec",   reverseSpec: true,  prd: false },
  "large:greenfield":  { interview: "full",  specTool: "spec-kit",   reverseSpec: false, prd: true  },
  // 여러 시스템에 걸치면 "무엇을 하지 않을 것인가"는 코드에 없다. 짧게 남긴다.
  "large:brownfield":  { interview: "short", specTool: "openspec",   reverseSpec: true,  prd: false },
};

export function planWork({ cwd, size } = {}, deps = {}) {
  const s = SIZES.has(size) ? size : "medium";   // 모르면 중간이 가장 덜 틀린다
  const c = classify(cwd, deps);
  return { size: s, ...c, ...MATRIX[`${s}:${c.kind}`] };
}

if (process.argv[1] && /plan\.mjs$/.test(process.argv[1])) {
  const i = process.argv.indexOf("--size");
  process.stdout.write(JSON.stringify(planWork({ cwd: process.argv[2] || process.cwd(), size: i > -1 ? process.argv[i + 1] : undefined })) + "\n");
}
