// WallpaperEngineApp(4,985줄 광고 코드 · 계약 테스트 22개)에서 채굴했다.
// 그 저장소가 ToonTone 광고 정책의 도너이고, "번들 기본값 사고로 접이식 배너가
// 전 등급 영구 OFF" 가 거기서 났다 — 이미 대가를 치른 지식이다.
import { describe, it, expect } from "vitest";
import { loadAdsPolicy, checkAdPolicy } from "../../plugins/nereus-ads/lib/ad-policy-check.mjs";

describe("ads-policy.json — 정책은 데이터다", () => {
  it("포맷 7종과 두 플랫폼의 데모 단위가 데이터로 있다", () => {
    const p = loadAdsPolicy();
    expect(p.formats.length).toBeGreaterThanOrEqual(7);
    for (const os of ["android", "ios"]) {
      for (const f of p.formats) {
        expect(p.demoUnits[os][f], `${os}/${f}`).toMatch(/^ca-app-pub-3940256099942544\//);
      }
    }
  });

  it("정책 수치에 출처와 확인일이 붙어 있다 — 남이 정하고 남이 바꾼다", () => {
    const p = loadAdsPolicy();
    expect(p.source).toMatch(/^https:\/\//);
    expect(p.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("중단형 포맷이 데이터로 선언되어 있다", () => {
    const p = loadAdsPolicy();
    expect(p.interruptiveFormats).toContain("interstitial");
    expect(p.interruptiveFormats).not.toContain("rewarded");
  });
});

const codes = (r: any) => r.violations.map((v: any) => v.code);
const unit = (resolvedId: string, format = "interstitial", platform = "android") => ({ format, platform, resolvedId });
const DEMO = "ca-app-pub-3940256099942544/1033173712";
const PROD = "ca-app-pub-6294755768841981/1111111111";

describe("checkAdPolicy — 무효 트래픽 방어", () => {
  it("디버그에서 프로덕션 단위를 쓰면 잡는다 — 누적되면 계정이 정지된다", () => {
    const r = checkAdPolicy({ build: { debug: true }, units: [unit(PROD)] });
    expect(codes(r)).toContain("prod-unit-in-debug");
  });

  it("디버그에서 데모 단위는 통과한다", () => {
    expect(checkAdPolicy({ build: { debug: true }, units: [unit(DEMO)] }).violations).toEqual([]);
  });

  it("릴리스에 데모 단위가 남으면 잡는다 — 수익이 0 이 되고 조용하다", () => {
    const r = checkAdPolicy({ build: { debug: false }, units: [unit(DEMO)] });
    expect(codes(r)).toContain("demo-unit-in-release");
  });

  it("릴리스에 프로덕션 단위는 통과한다", () => {
    expect(checkAdPolicy({ build: { debug: false }, units: [unit(PROD)] }).violations).toEqual([]);
  });

  it("플랫폼이 다르면 그 플랫폼의 데모 단위로 판정한다", () => {
    const iosDemo = loadAdsPolicy().demoUnits.ios.rewarded;
    const r = checkAdPolicy({ build: { debug: true }, units: [unit(iosDemo, "rewarded", "ios")] });
    expect(r.violations).toEqual([]);
  });

  it("안드로이드 데모 단위를 iOS 에 쓰면 잡는다 — 표를 그대로 믿지 않는다", () => {
    const r = checkAdPolicy({ build: { debug: true }, units: [unit(DEMO, "interstitial", "ios")] });
    expect(codes(r)).toContain("prod-unit-in-debug");
  });

  it("빌드 정보를 안 주면 이 검사를 건너뛴다 — 모르는 것과 통과는 다르다", () => {
    expect(codes(checkAdPolicy({ units: [unit(PROD)] }))).not.toContain("prod-unit-in-debug");
  });

  it("위반에 이유가 실린다", () => {
    const r = checkAdPolicy({ build: { debug: true }, units: [unit(PROD)] });
    expect(String(r.violations[0].why).length).toBeGreaterThan(20);
  });
});

describe("checkAdPolicy — 첫 세션 보호", () => {
  it("카운터가 없으면 첫 세션으로 본다 — 보호 해제로 읽으면 조용히 최악으로 떨어진다", () => {
    const r = checkAdPolicy({ session: { launchCount: 0 }, plan: { formats: ["interstitial"] } });
    expect(codes(r)).toContain("first-session-interruptive");
  });

  it("session 자체가 없어도 보호 구간으로 본다", () => {
    expect(codes(checkAdPolicy({ plan: { formats: ["interstitial"] } }))).toContain("first-session-interruptive");
  });

  it("보호 구간의 리워드는 막지 않는다 — 사용자가 스스로 고른 것이다", () => {
    const r = checkAdPolicy({ session: { launchCount: 0 }, plan: { formats: ["rewarded"] } });
    expect(codes(r)).not.toContain("first-session-interruptive");
  });

  it("두 번째 세션부터는 중단형을 허용한다", () => {
    const r = checkAdPolicy({ session: { launchCount: 2 }, plan: { formats: ["interstitial"] } });
    expect(codes(r)).not.toContain("first-session-interruptive");
  });

  it("킬 스위치로 끄면 보호가 적용되지 않는다", () => {
    const r = checkAdPolicy({ session: { launchCount: 0, protectionEnabled: false }, plan: { formats: ["interstitial"] } });
    expect(codes(r)).not.toContain("first-session-interruptive");
  });

  it("계획을 안 주면 이 검사를 건너뛴다", () => {
    expect(codes(checkAdPolicy({ session: { launchCount: 0 } }))).not.toContain("first-session-interruptive");
  });
});

describe("checkAdPolicy — 동의 순서", () => {
  it("동의 전에 초기화하면 잡는다", () => {
    expect(codes(checkAdPolicy({ consent: { initBeforeConsent: true } }))).toContain("init-before-consent");
  });

  it("동의로 건너뛴 포맷에 재시도가 없으면 잡는다 — 그 세션 동안 영원히 빈다", () => {
    const r = checkAdPolicy({ consent: { skippedForConsent: ["banner", "native"], retryRegistered: ["banner"] } });
    const v = r.violations.filter((x: any) => x.code === "consent-retry-missing");
    expect(v.map((x: any) => x.format)).toEqual(["native"]);
  });

  it("전부 등록되어 있으면 통과한다", () => {
    const r = checkAdPolicy({ consent: { skippedForConsent: ["banner"], retryRegistered: ["banner"] } });
    expect(codes(r)).not.toContain("consent-retry-missing");
  });

  it("건너뛴 게 없으면 통과한다", () => {
    expect(checkAdPolicy({ consent: { skippedForConsent: [], retryRegistered: [] } }).violations).toEqual([]);
  });
});

describe("checkAdPolicy — 타게팅 신호 일관성", () => {
  const t = { keywords: ["wallpaper", "kpop"], contentUrl: "https://example.com" };

  it("포맷마다 신호가 다르면 잡는다", () => {
    const r = checkAdPolicy({ targeting: { fixedBanner: t, rewarded: { keywords: ["kpop"], contentUrl: "https://example.com" } } });
    expect(codes(r)).toContain("targeting-mismatch");
  });

  it("빈 요청을 잡는다 — 도너에서 배너·인라인 네이티브만 빈 요청을 보내 매치율이 깎였다", () => {
    const r = checkAdPolicy({ targeting: { fixedBanner: { keywords: [], contentUrl: null }, rewarded: t } });
    expect(codes(r)).toContain("targeting-empty");
  });

  it("전부 같으면 통과한다", () => {
    expect(checkAdPolicy({ targeting: { fixedBanner: t, rewarded: t } }).violations).toEqual([]);
  });

  it("키워드 순서가 달라도 같은 신호로 본다 — 순서는 타게팅에 의미가 없다", () => {
    const flipped = { keywords: ["kpop", "wallpaper"], contentUrl: t.contentUrl };
    expect(checkAdPolicy({ targeting: { fixedBanner: t, rewarded: flipped } }).violations).toEqual([]);
  });

  it("포맷이 하나면 비교 대상이 없어 통과한다", () => {
    expect(checkAdPolicy({ targeting: { rewarded: t } }).violations).toEqual([]);
  });

  it("개인화 선언이 없는 것은 위반이 아니다 — UMP 동의와 SDK 가 정한다", () => {
    expect(checkAdPolicy({ targeting: { fixedBanner: t, rewarded: t } }).violations).toEqual([]);
  });

  it("불일치 보고에 어느 포맷인지가 실린다", () => {
    const r = checkAdPolicy({ targeting: { fixedBanner: t, rewarded: { keywords: ["kpop"], contentUrl: t.contentUrl } } });
    const v = r.violations.find((x: any) => x.code === "targeting-mismatch");
    expect(v.formats).toContain("rewarded");
  });
});
