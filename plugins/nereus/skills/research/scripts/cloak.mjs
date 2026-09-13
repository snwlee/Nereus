// CloakBrowser 무료 티어 고정 검사.
//
// 조사에서 차단(403·Cloudflare·캡차)에 막혔을 때만 쓰는 **선택 경로**다.
// 우리 앱의 E2E·design·SEO 는 chrome-devtools MCP 가 계속 담당한다 — 자기 사이트에
// 봇 탐지를 우회할 이유가 없고, 이쪽은 Lighthouse·CDP 트레이스·콘솔 수집이 아예 없다.
//
// **고정하지 않으면 최신 빌드를 받는다.** 최신은 v148+ 이고 Pro 구독이 있어야 내려받아진다.
// 즉 "무료로 쓰겠다"는 결정은 핀이 있어야만 성립한다. 핀이 없는 상태는 기본값이 아니라 위반이다.
//
// 근거 (확인 2026-09-13):
// - https://github.com/CloakHQ/CloakBrowser/releases — 무료 최신 태그 `chromium-v146.0.7680.177.5`,
//   v148 이상은 전부 `-pro` 접미사
// - README: "v146 and earlier — free for personal and commercial use, no redistribution
//   (OEM/SaaS license required to serve third parties). v148 and later — requires an active
//   CloakBrowser Pro subscription to download."
// - 래퍼(Python·JS)는 MIT, 바이너리만 이 조건이다.

/** 무료 티어의 가장 높은 빌드. 올릴 때는 릴리스에서 `-pro` 가 없는 것만 고른다. */
export const FREE_PIN = "146.0.7680.177.5";
/** 이 메이저까지 무료. v147 은 존재하지 않고 v148 부터 Pro 다. */
const FREE_MAX_MAJOR = 146;

const PIN_ENV = "CLOAKBROWSER_VERSION";
const LICENSE_ENV = "CLOAKBROWSER_LICENSE_KEY";

/** 고정 명령 한 줄. 핀 값을 문서에 두 번 적지 않기 위해 여기서만 만든다. */
export const exportLine = () => `export ${PIN_ENV}=${FREE_PIN}`;

/**
 * 현재 환경이 무료 티어로 고정돼 있는지.
 *
 * 읽을 수 없는 핀을 무료로 단정하지 않는다 — 오타 하나로 Pro 를 받으러 가고,
 * 그 사실은 다운로드가 실패하기 전까지 드러나지 않는다.
 *
 * @returns {{ tier: "free"|"pro"|"unpinned"|"unknown", ok: boolean, version: string|null,
 *             major: number|null, violations: Array<{code: string, why: string}>, fix: string }}
 */
export function cloakPlan(env = process.env) {
  const raw = env?.[PIN_ENV];
  const violations = [];
  const base = { version: raw ?? null, major: null, fix: exportLine() };

  let tier, major = null;
  if (!raw) {
    tier = "unpinned";
    violations.push({ code: "unpinned", why: `${PIN_ENV} 가 없다. 고정하지 않으면 최신(v148+, Pro)을 받는다` });
  } else {
    const m = /^(\d+)\./.exec(String(raw).trim());
    if (!m) {
      tier = "unknown";
      violations.push({ code: "unparsable", why: `${PIN_ENV}='${raw}' 에서 메이저를 읽을 수 없다. 무료로 단정하지 않는다` });
    } else {
      major = Number(m[1]);
      tier = major <= FREE_MAX_MAJOR ? "free" : "pro";
      if (tier === "pro") {
        violations.push({ code: "pro-version", why: `v${major} 는 Pro 구독이 있어야 내려받아진다. 무료는 v${FREE_MAX_MAJOR} 이하다` });
      }
    }
  }

  if (env?.[LICENSE_ENV]) {
    violations.push({ code: "license-key-set", why: `${LICENSE_ENV} 가 설정돼 있다. 유료 경로가 열려 있으면 무료 고정이 무의미하다` });
  }

  return { ...base, tier, major, ok: violations.length === 0, violations };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.stdout.write(JSON.stringify(cloakPlan(), null, 2) + "\n");
}
