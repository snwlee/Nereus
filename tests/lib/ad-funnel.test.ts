// 수익 레버는 게이트가 아니라 **조언자**다 — 어디에 힘을 쓸지는 사업 판단이다.
// WallpaperEngineApp 의 수익 분석 보고서(266줄)에서 **방법론만** 채굴했다.
// 실측 수치는 우리 계정·시점 종속이라 넣지 않는다 — 조용히 낡은 수치가 틀린 확신을 만든다.
import { describe, it, expect } from "vitest";
import { analyzeFunnel } from "../../plugins/nereus-ads/lib/ad-funnel.mjs";

// 도너 실측의 **모양**만 가져온다(채움은 멀쩡한데 지면이 문제인 형태). 값 자체는 픽스처다.
const rewarded = { format: "rewarded", requests: 163000, matched: 150881, impressions: 25803, revenue: 170 };
const targets = { showRate: 0.3, matchRate: 0.8 };

describe("analyzeFunnel — 병목은 단계별로 지목한다", () => {
  it("채움은 멀쩡한데 지면이 문제인 경우를 show 병목으로 지목한다", () => {
    expect(analyzeFunnel({ formats: [rewarded], targets }).bottleneck.rewarded).toBe("show");
  });

  it("두 비율을 따로 낸다 — 하나로 뭉치면 고칠 곳이 뒤집힌다", () => {
    const r = analyzeFunnel({ formats: [rewarded], targets });
    expect(r.rates.rewarded.matchRate).toBeGreaterThan(0.9);
    expect(r.rates.rewarded.showRate).toBeLessThan(0.2);
  });

  it("매치가 낮으면 match 병목이다 — 재고·미디에이션 문제다", () => {
    const starved = { format: "banner", requests: 1000, matched: 370, impressions: 350, revenue: 1 };
    expect(analyzeFunnel({ formats: [starved], targets }).bottleneck.banner).toBe("match");
  });

  it("둘 다 기준을 넘으면 병목이 없다", () => {
    const healthy = { format: "rewarded", requests: 1000, matched: 950, impressions: 400, revenue: 50 };
    expect(analyzeFunnel({ formats: [healthy], targets }).bottleneck.rewarded).toBeUndefined();
  });

  it("기준이 없으면 병목을 단정하지 않는다 — 기본값을 지어내면 그럴듯하게 틀린다", () => {
    const r = analyzeFunnel({ formats: [rewarded] });
    expect(r.bottleneck).toEqual({});
    expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/기준/);
  });

  it("요청이 0 이면 비율이 null 이다 — 나눗셈을 하지 않는다", () => {
    const empty = { format: "banner", requests: 0, matched: 0, impressions: 0, revenue: 0 };
    const r = analyzeFunnel({ formats: [empty], targets });
    expect(r.rates.banner.matchRate).toBeNull();
    expect(r.rates.banner.showRate).toBeNull();
    expect(r.bottleneck.banner).toBeUndefined();
  });

  it("게이트가 아니다 — violations 를 내지 않는다", () => {
    expect(analyzeFunnel({ formats: [rewarded], targets }).violations).toBeUndefined();
  });
});

describe("analyzeFunnel — 믹스 역전", () => {
  const mix = [
    { format: "fixedBanner", requests: 1000, matched: 400, impressions: 780, revenue: 24 },
    { format: "rewarded", requests: 1000, matched: 900, impressions: 220, revenue: 76 },
  ];

  it("노출 점유가 수익 점유보다 크면 역전으로 표시한다", () => {
    const r = analyzeFunnel({ formats: mix });
    const codes = r.levers.filter((l: any) => l.format === "fixedBanner").map((l: any) => l.code);
    expect(codes).toContain("mix-inversion");
  });

  it("역전이 아닌 포맷에는 붙지 않는다", () => {
    const r = analyzeFunnel({ formats: mix });
    const codes = r.levers.filter((l: any) => l.format === "rewarded").map((l: any) => l.code);
    expect(codes).not.toContain("mix-inversion");
  });

  it("두 점유율을 같이 낸다 — 비율 하나만 보면 없애라는 뜻으로 읽힌다", () => {
    const lever = analyzeFunnel({ formats: mix }).levers.find((l: any) => l.code === "mix-inversion");
    expect(lever.impressionShare).toBeGreaterThan(lever.revenueShare);
  });

  it("처방이 노출을 줄이라고 말하지 않는다 — 줄이라는 처방은 꺼진다", () => {
    const lever = analyzeFunnel({ formats: mix }).levers.find((l: any) => l.code === "mix-inversion");
    expect(lever.advice).not.toMatch(/줄이|제거|없애|삭제/);
  });

  it("포맷이 하나면 점유율 비교가 의미 없어 역전을 내지 않는다", () => {
    const r = analyzeFunnel({ formats: [rewarded] });
    expect(r.levers.map((l: any) => l.code)).not.toContain("mix-inversion");
  });
});

describe("analyzeFunnel — 답할 수 없는 것", () => {
  it("show 병목이면 원인은 앱 내 이벤트 로그가 있어야 안다고 낸다", () => {
    const r = analyzeFunnel({ formats: [rewarded], targets });
    expect(r.unanswerable.map((u: any) => u.needs).join(" ")).toMatch(/이벤트 로그/);
  });

  it("CTR 이 임계를 넘으면 정책 리포트가 필요하다고 낸다", () => {
    const clicky = { format: "interstitial", requests: 100, matched: 100, impressions: 100, clicks: 20, revenue: 1 };
    const r = analyzeFunnel({ formats: [clicky], targets: { ...targets, maxCtr: 0.1 } });
    expect(r.unanswerable.map((u: any) => u.needs).join(" ")).toMatch(/정책 리포트/);
  });

  it("CTR 기준이 없으면 그 질문을 만들지 않는다", () => {
    const clicky = { format: "interstitial", requests: 100, matched: 100, impressions: 100, clicks: 20, revenue: 1 };
    const r = analyzeFunnel({ formats: [clicky], targets });
    expect(r.unanswerable.map((u: any) => u.needs).join(" ")).not.toMatch(/정책 리포트/);
  });

  it("항상 트래픽 전제를 적는다 — 모든 레버 추정은 현재 matched 를 가정한다", () => {
    const r = analyzeFunnel({ formats: [rewarded], targets });
    expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/트래픽/);
  });
});
