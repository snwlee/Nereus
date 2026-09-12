// 오디오 예산 검사기. asset 이 소리를 만들고, 여기서는 그 소리를 어떻게 쓰는지만 본다.
// 체크리스트가 아니라 수치다 — 그래야 게이트가 사람 판단에 의존하지 않는다.
import { readFileSync } from "node:fs";
import { loadProfile } from "./profiles.mjs";
export function checkSound({ profile, plan } = {}) {
  const base = profile?.sound;
  // 기준이 없으면 통과시키지 않는다. 조용한 통과가 없는 게이트보다 나쁘다.
  if (!base || typeof base !== "object") return { violations: [{ code: "no-baseline" }] };

  const violations = [];
  const cues = Array.isArray(plan?.cues) ? plan.cues : [];
  const actions = Array.isArray(plan?.actions) ? plan.actions : [];

  const max = Number(base.maxConcurrent);
  const used = Number(plan?.maxConcurrent);
  if (Number.isFinite(max) && Number.isFinite(used) && used > max) {
    violations.push({ code: "concurrency", used, max });
  }

  const minVariants = Number(base.minVariants);
  if (Number.isFinite(minVariants)) {
    for (const cue of cues) {
      const n = Number(cue?.variants) || 0;
      if (n < minVariants) violations.push({ code: "variants", cue: cue?.name ?? "", variants: n, min: minVariants });
    }
  }

  const range = base.loudnessLufs;
  const lufs = Number(plan?.loudnessLufs);
  if (Array.isArray(range) && range.length === 2 && Number.isFinite(lufs) && (lufs < range[0] || lufs > range[1])) {
    violations.push({ code: "loudness", lufs, range: [range[0], range[1]] });
  }

  const covered = new Set(cues.flatMap((c) => (Array.isArray(c?.actions) ? c.actions : [])));
  for (const a of actions) {
    if (!covered.has(a)) violations.push({ code: "no-feedback", action: a });
  }

  return { violations };
}

// 실행 진입점. stdin 으로 { genre, plan } 을 받아 결과를 JSON 으로 낸다.
// 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = JSON.parse(readStdin() || "{}");
  // loadProfile 이 알 수 없는 장르에 던진다 — 그때 프로세스는 0 이 아닌 코드로 끝난다.
  const profile = loadProfile(input.genre);
  process.stdout.write(JSON.stringify(checkSound({ profile, plan: input.plan })) + "\n");
  process.exit(0);
}
