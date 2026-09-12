// 임팩트(타격감) 예산 검사기.
//
// 조작감은 미감이 아니라 타이밍과 예산이다. 그래서 체크리스트가 아니라 수치로 판정한다.
//
// 두 가지를 **합으로** 본다. 개별 값만 보면 놓치는 양상이 있기 때문이다:
//  - 히트스톱: 한 번 80ms 는 문제가 아니다. 초당 누적 정지 시간이 길어지면 게임이 끊겨 보인다.
//  - 셰이크: 각각 0.4 인 셰이크 셋이 겹치면 1.2 다. 그건 화면이 무너진 것이다.
//
// 그리고 **사운드 큐와 교차 검증한다.** 사운드 검사는 "선언된 큐가 예산 안"이라 하고
// 임팩트 검사는 "이펙트가 예산 안"이라 하는데, 둘이 서로를 안 보면
// 소리 없이 터지는 이펙트를 아무도 못 잡는다. 도메인별 초록의 합은 게임의 초록이 아니다.
import { readFileSync } from "node:fs";
import { loadProfile } from "./profiles.mjs";

export function checkImpact({ profile, plan, soundCues = null } = {}) {
  const base = profile?.impact;
  // 기준이 없으면 다른 검사를 하지 않는다. 기준 없이 낸 통과는 없는 게이트보다 나쁘다.
  if (!base || typeof base !== "object") return { violations: [{ code: "no-baseline" }], unmeasured: [] };

  const violations = [];
  const unmeasured = [];
  const cues = Array.isArray(plan?.cues) ? plan.cues : [];

  const frozenMsPerSec = cues.reduce((a, c) => a + (Number(c?.hitstopMs) || 0) * (Number(c?.hitsPerSecond) || 0), 0);
  const maxFrozen = Number(base.maxFrozenMsPerSec);
  if (Number.isFinite(maxFrozen) && frozenMsPerSec > maxFrozen) {
    violations.push({ code: "hitstop-budget", frozenMsPerSec, max: maxFrozen });
  }

  const shakeSum = cues.reduce((a, c) => a + (c?.shake?.concurrent ? Number(c.shake.amplitude) || 0 : 0), 0);
  const maxShake = Number(base.maxShakeAmplitude);
  if (Number.isFinite(maxShake) && shakeSum > maxShake) {
    violations.push({ code: "shake-amplitude", amplitude: Math.round(shakeSum * 100) / 100, max: maxShake });
  }

  const maxParticles = Number(base.maxParticles);
  const usedParticles = Number(plan?.maxParticles);
  if (Number.isFinite(maxParticles) && Number.isFinite(usedParticles) && usedParticles > maxParticles) {
    violations.push({ code: "particle-budget", used: usedParticles, max: maxParticles });
  }

  const minBuffer = Number(base.minInputBufferMs);
  const buffer = Number(plan?.inputBufferMs);
  if (Number.isFinite(minBuffer) && Number.isFinite(buffer) && buffer < minBuffer) {
    violations.push({ code: "input-buffer", inputBufferMs: buffer, min: minBuffer });
  }

  for (const c of cues) {
    // 한 층만 있으면 그 감각을 못 쓰는 환경에서 피드백이 통째로 사라진다.
    const layers = [Boolean(c?.visual), Boolean(String(c?.sound ?? "").trim()), Boolean(c?.haptic)].filter(Boolean).length;
    if (layers < 2) violations.push({ code: "single-channel", cue: c?.name ?? "", layers });
    // 문장으로 "끌 수 있게 한다"고 적는 것은 게이트가 아니다. 선언을 요구한다.
    if (c?.shake && !String(c?.reducedMotion ?? "").trim()) {
      violations.push({ code: "no-reduced-motion", cue: c?.name ?? "" });
    }
  }

  if (!Array.isArray(soundCues)) {
    unmeasured.push("sound-cross-check");
  } else {
    const known = new Set(soundCues);
    for (const c of cues) {
      const name = String(c?.sound ?? "").trim();
      if (!name || !known.has(name)) violations.push({ code: "sound-missing", cue: c?.name ?? "", sound: name });
    }
  }

  return { violations, unmeasured };
}

// 실행 진입점. stdin 으로 { genre, plan, soundCues } 를 받아 결과를 JSON 으로 낸다.
// 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = JSON.parse(readStdin() || "{}");
  // loadProfile 이 알 수 없는 장르에 던진다 — 그때 프로세스는 0 이 아닌 코드로 끝난다.
  const profile = loadProfile(input.genre);
  process.stdout.write(JSON.stringify(checkImpact({ profile, plan: input.plan, soundCues: input.soundCues ?? null })) + "\n");
  process.exit(0);
}
