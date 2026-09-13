// 광고 정책 게이트 — 어기면 계정이 정지된다.
//
// WallpaperEngineApp 에서 채굴했다(광고 소스 4,985줄 · 계약 테스트 22개, 2026-09-13).
// 그 저장소가 ToonTone 광고 정책의 도너다 — 여기 담긴 것은 이미 대가를 치른 지식이다.
//
// **이 파일은 게이트다.** 수익 레버는 ad-funnel.mjs 가 조언한다.
// 한 파일에 섞으면 "정지 위험"과 "돈 더 벌 수 있음"이 같은 무게로 나와 진짜가 묻힌다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// new URL(...).pathname 은 Windows 에서 `/C:/...` 가 된다. 메인 개발 환경이 Windows 다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const POLICY_PATH = path.join(HERE, "..", "ads-policy.json");

/**
 * 광고 정책 데이터를 읽는다.
 * 포맷 목록·데모 단위 표·중단형 포맷은 전부 데이터다 — 구글이 정하고 구글이 바꾼다.
 */
export function loadAdsPolicy(policyPath = POLICY_PATH) {
  return JSON.parse(fs.readFileSync(policyPath, "utf8"));
}

/**
 * 광고 정책 게이트. 주지 않은 축은 **검사하지 않는다** —
 * 모르는 것과 통과한 것을 같게 보고하면 검사되지 않은 것이 통과로 읽힌다.
 *
 * @param build     `{ debug }` — 없으면 단위 검사를 건너뛴다
 * @param units     `[{ format, platform, resolvedId }]` 실제로 SDK 에 넘어가는 단위
 * @returns `{ violations }`
 */
export function checkAdPolicy({ build = null, units = null, session = null, plan = null, consent = null, targeting = null, policy = null } = {}) {
  const p = policy ?? loadAdsPolicy();
  const violations = [];

  // ── 무효 트래픽 방어 ────────────────────────────────────────────────────
  // 개발 기기가 프로덕션 광고 단위에 트래픽을 만들면 무효 트래픽으로 집계되고,
  // 누적되면 계정이 정지된다. **되돌릴 수 없는 손실**이라 가장 먼저 본다.
  if (build && Array.isArray(units)) {
    for (const u of units) {
      // 표를 그대로 믿지 않는다 — 플랫폼마다 데모 단위가 다르다.
      // 안드로이드 데모 ID 를 iOS 에 쓰면 그건 그 플랫폼의 데모가 아니다.
      const demo = p.demoUnits?.[u?.platform]?.[u?.format] ?? null;
      const isDemo = demo != null && u?.resolvedId === demo;

      if (build.debug === true && !isDemo) {
        violations.push({
          code: "prod-unit-in-debug",
          format: u?.format,
          platform: u?.platform,
          resolvedId: u?.resolvedId,
          expected: demo,
          why: "디버그 빌드가 프로덕션 광고 단위에 트래픽을 만든다. 무효 트래픽으로 집계되고 누적되면 계정이 정지된다 — 되돌릴 수 없다.",
        });
      }
      if (build.debug === false && isDemo) {
        violations.push({
          code: "demo-unit-in-release",
          format: u?.format,
          platform: u?.platform,
          resolvedId: u?.resolvedId,
          why: "릴리스 빌드에 데모 단위가 남았다. 광고는 정상으로 보이는데 수익이 0 이고 아무 에러도 나지 않는다.",
        });
      }
    }
  }

  // ── 첫 세션 보호 ───────────────────────────────────────────────────────
  // 첫 세션 전면 광고는 업계에서 가장 비싼 실수로 꼽힌다 — 미루면 D1 리텐션이 오르고
  // 어차피 첫 세션은 수익이 안 난다. **미설정은 보호 해제가 아니라 보호다**:
  // 한 세션 더 보호하는 비용이 진짜 첫 세션에 전면 광고를 띄우는 비용보다 싸다.
  if (Array.isArray(plan?.formats)) {
    const enabled = session?.protectionEnabled ?? true;
    const launchCount = Number(session?.launchCount) || 0;
    const protectedNow = enabled && launchCount <= 1;
    if (protectedNow) {
      const interruptive = new Set(p.interruptiveFormats ?? []);
      for (const format of plan.formats) {
        // 사용자가 시작한 포맷은 막지 않는다. 스스로 고른 것을 막으면 보상 경로가 끊긴다.
        if (!interruptive.has(format)) continue;
        violations.push({
          code: "first-session-interruptive",
          format,
          launchCount,
          why: "첫 세션에 중단형 광고를 띄운다. D1 리텐션을 깎는데 첫 세션은 어차피 수익이 안 난다 — 미루는 쪽이 양쪽으로 이득이다.",
        });
      }
    }
  }

  // ── 동의 순서 ──────────────────────────────────────────────────────────
  if (consent) {
    if (consent.initBeforeConsent === true) {
      violations.push({
        code: "init-before-consent",
        why: "동의가 해석되기 전에 광고를 초기화했다. 동의 없이 개인화 신호가 나가면 규정 위반이고, 되돌릴 수 없다.",
      });
    }
    const registered = new Set(consent.retryRegistered ?? []);
    for (const format of consent.skippedForConsent ?? []) {
      if (registered.has(format)) continue;
      violations.push({
        code: "consent-retry-missing",
        format,
        why: "동의가 준비되기 전에 건너뛴 로드가 재시도되지 않는다. 그 세션 동안 이 포맷은 영원히 비어 있고 아무 에러도 나지 않는다.",
      });
    }
  }

  // ── 타게팅 신호 일관성 ─────────────────────────────────────────────────
  // 모든 포맷이 **같은** 키워드·contentUrl 을 보내야 매칭이 일관되고 eCPM 이 유지된다.
  // 도너에서는 배너와 인라인 네이티브만 빈 요청을 보내 매치율이 깎였다 —
  // 이 손실은 에러가 아니라 낮은 매치율로만 나타나서 보고서를 열기 전에는 보이지 않는다.
  //
  // 개인화는 판정 대상이 아니다. UMP 동의와 SDK(TCF 문자열)가 정한다 —
  // 여기서 판정하면 두 곳이 같은 것을 정하게 된다.
  if (targeting && typeof targeting === "object") {
    const entries = Object.entries(targeting);
    // 키워드 순서는 타게팅에 의미가 없다. 정렬해 비교하지 않으면 순서만 다른 것을 불일치로 본다.
    const sign = (t) => JSON.stringify({ k: [...(t?.keywords ?? [])].sort(), u: t?.contentUrl ?? null });

    for (const [format, t] of entries) {
      if ((t?.keywords ?? []).length === 0 && !t?.contentUrl) {
        violations.push({
          code: "targeting-empty",
          format,
          why: "이 포맷이 타게팅 신호 없이 요청한다. 매치율이 떨어지는데 에러가 아니라 낮은 매치율로만 나타나 보고서를 열기 전에는 보이지 않는다.",
        });
      }
    }

    const groups = new Map();
    for (const [format, t] of entries) groups.set(sign(t), [...(groups.get(sign(t)) ?? []), format]);
    if (groups.size > 1) {
      // 다수파를 기준으로 삼는다. 어느 쪽이 맞는지는 하네스가 모르지만,
      // **갈렸다는 사실**과 어느 포맷이 소수인지는 알 수 있다.
      const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
      violations.push({
        code: "targeting-mismatch",
        formats: sorted.slice(1).flat(),
        groups: sorted,
        why: "포맷마다 타게팅 신호가 다르다. 같은 신호를 보내야 매칭이 일관되고 eCPM 이 유지된다 — 갈린 쪽은 조용히 매치율을 잃는다.",
      });
    }
  }

  return { violations };
}
