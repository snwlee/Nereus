// 효과음 라이선스 판정. 광고·상업 영상에 써도 되는 것만 통과시킨다. 순수 함수.
// allow  — 표기 없이 쓴다 (CC0, 퍼블릭 도메인, 코드 합성음)
// credit — 쓰되 SOUNDS.md 에 표기가 있어야 한다 (CC-BY)
// block  — 비상업·변경금지·동일조건·sampling+·미상
const ALLOW = new Set(["cc0", "pdm", "synth"]);
const CREDIT = new Set(["by"]);

export function classifyLicense(license) {
  const l = String(license ?? "").trim().toLowerCase();
  if (ALLOW.has(l)) return { verdict: "allow", license: l };
  if (CREDIT.has(l)) return { verdict: "credit", license: l };
  return { verdict: "block", license: l };
}
