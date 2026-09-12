// 라이브옵스 계획 검사기.
//
// 실제 운영 지표는 아직 없다. 그래도 **계획의 내적 정합성**은 지금 판정할 수 있다 —
// 구간 겹침 · 싱크/소스 균형 · 리텐션 곡선 형태 · 롤백 경로 존재는 지표와 무관하다.
// 지표가 필요한 항목만 unmeasured 로 남긴다. 미설정과 실패를 구분한다.
import { readFileSync } from "node:fs";
import { loadProfile } from "./profiles.mjs";
const DAYS = ["d1", "d7", "d30"];

export function checkLiveops({ profile, plan, metrics = null } = {}) {
  const violations = [];
  const unmeasured = [];
  const events = Array.isArray(plan?.events) ? plan.events : [];

  const sorted = [...events].sort((a, b) => Number(a?.start) - Number(b?.start));
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    // 닿는 것은 겹침이 아니다 — [start, end) 반열린 구간이다.
    if (Number(cur?.start) < Number(prev?.end)) {
      violations.push({ code: "overlap", events: [prev?.name ?? "", cur?.name ?? ""] });
    }
  }

  for (const e of events) {
    if (!String(e?.rollback ?? "").trim()) violations.push({ code: "no-rollback", event: e?.name ?? "" });
  }

  const sum = (list) => (Array.isArray(list) ? list : []).reduce((a, x) => a + (Number(x?.amount) || 0), 0);
  const sources = sum(plan?.economy?.sources);
  const sinks = sum(plan?.economy?.sinks);
  if (sources > 0 && sinks === 0) violations.push({ code: "no-sink", sources });

  const curve = DAYS.map((d) => Number(plan?.retention?.[d])).filter((n) => Number.isFinite(n));
  for (let i = 1; i < curve.length; i += 1) {
    if (curve[i] > curve[i - 1]) { violations.push({ code: "retention-shape", curve }); break; }
  }

  const actual = metrics?.retention;
  if (!actual) {
    unmeasured.push("retention-actual");
  } else {
    const allow = Number(profile?.liveops?.retentionDriftPct);
    if (Number.isFinite(allow)) {
      for (const d of DAYS) {
        const want = Number(plan?.retention?.[d]);
        const got = Number(actual?.[d]);
        if (!Number.isFinite(want) || !Number.isFinite(got) || want === 0) continue;
        const driftPct = Math.abs(got - want) / want * 100;
        if (driftPct > allow) violations.push({ code: "retention-drift", day: d, want, got });
      }
    }
  }

  return { violations, unmeasured };
}

// 실행 진입점. stdin 으로 { genre, plan, metrics } 을 받아 결과를 JSON 으로 낸다.
// 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = JSON.parse(readStdin() || "{}");
  // loadProfile 이 알 수 없는 장르에 던진다 — 그때 프로세스는 0 이 아닌 코드로 끝난다.
  const profile = loadProfile(input.genre);
  process.stdout.write(JSON.stringify(checkLiveops({ profile, plan: input.plan, metrics: input.metrics ?? null })) + "\n");
  process.exit(0);
}
