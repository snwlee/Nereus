import { describe, it, expect } from "vitest";
import { countScope, recommendTrack } from "../../plugins/nereus-game/lib/track-advisor.mjs";
import { loadTracks } from "../../plugins/nereus-game/lib/tracks.mjs";

const tracks = loadTracks();
const codes = (r: any) => r.reasons.map((x: any) => x.code);
const mis = (r: any) => r.mismatches.map((x: any) => x.code);
const small = { tasks: 8, flows: 1 };
const big = { tasks: 99, flows: 5 };
const indie = { platform: "steam", revenue: "premium", liveEvents: false, persistentMultiplayer: false };

describe("countScope", () => {
  it("완료·미완료 태스크를 모두 센다", () => {
    expect(countScope("- [ ] T1. a\n- [x] T2. b\n- [ ] T3. c\n").tasks).toBe(3);
  });
  it("flow 태스크를 따로 센다", () => {
    const s = countScope("- [ ] T1. a [flow]\n- [x] T2. b\n- [ ] T3. c [flow]\n");
    expect(s.tasks).toBe(3);
    expect(s.flows).toBe(2);
  });
  it("빈 내용은 0 이다", () => {
    expect(countScope("")).toEqual({ tasks: 0, flows: 0 });
  });
  it("태스크가 아닌 체크박스는 세지 않는다", () => {
    expect(countScope("- [ ] 그냥 항목\n- [ ] T1. 진짜 태스크\n").tasks).toBe(1);
  });
});

describe("recommendTrack — 강제 조건이 먼저다", () => {
  it("로블록스는 깊게가 강제된다", () => {
    const r = recommendTrack({ tracks, scope: small, model: { ...indie, platform: "roblox" } });
    expect(r.recommendation).toBe("deep");
    expect(codes(r)).toContain("platform-roblox");
  });
  it("IAP 는 깊게가 강제된다", () => {
    const r = recommendTrack({ tracks, scope: small, model: { ...indie, revenue: "iap" } });
    expect(r.recommendation).toBe("deep");
    expect(codes(r)).toContain("revenue-iap");
  });
  it("라이브 이벤트 계획은 깊게가 강제된다", () => {
    const r = recommendTrack({ tracks, scope: small, model: { ...indie, liveEvents: true } });
    expect(r.recommendation).toBe("deep");
    expect(codes(r)).toContain("live-events");
  });
  it("상태 유지 멀티플레이어는 깊게가 강제된다", () => {
    const r = recommendTrack({ tracks, scope: small, model: { ...indie, persistentMultiplayer: true } });
    expect(r.recommendation).toBe("deep");
    expect(codes(r)).toContain("persistent-multiplayer");
  });
  it("강제 조건이 없고 규모가 작으면 다작이다", () => {
    expect(recommendTrack({ tracks, scope: small, model: indie }).recommendation).toBe("many");
  });
  it("강제 조건이 없어도 규모가 크면 다작이 아니다", () => {
    const r = recommendTrack({ tracks, scope: big, model: indie });
    expect(r.recommendation).toBe("deep");
    expect(codes(r)).toContain("scope-exceeds-many");
  });
  it("규모로 낸 근거에는 추정 표시가 붙는다", () => {
    const r = recommendTrack({ tracks, scope: big, model: indie });
    expect(r.reasons.find((x: any) => x.code === "scope-exceeds-many").estimate).toBe(true);
  });
  it("알 수 없는 플랫폼은 던진다", () => {
    expect(() => recommendTrack({ tracks, scope: small, model: { ...indie, platform: "nope" } })).toThrow(/알 수 없는 플랫폼/);
  });
  it("알 수 없는 수익 모델은 던진다", () => {
    expect(() => recommendTrack({ tracks, scope: small, model: { ...indie, revenue: "nope" } })).toThrow(/알 수 없는 수익 모델/);
  });
});

describe("불일치는 추천과 독립이다", () => {
  it("유료 단품인데 라이브 이벤트가 있으면 모순이다", () => {
    const r = recommendTrack({ tracks, scope: small, model: { ...indie, liveEvents: true } });
    expect(mis(r)).toContain("premium-with-live-events");
  });
  it("모순은 deep 추천에서도 그대로 보고된다", () => {
    const r = recommendTrack({ tracks, scope: small, model: { ...indie, liveEvents: true } });
    expect(r.recommendation).toBe("deep");
    expect(mis(r)).toContain("premium-with-live-events");
  });
  it("규모 초과는 불일치로도 보고되고 임계·실제값이 함께 나온다", () => {
    const r = recommendTrack({ tracks, scope: big, model: indie });
    const m = r.mismatches.find((x: any) => x.code === "scope-over-budget");
    expect(m.tasks).toBe(99);
    expect(m.maxTasks).toBe(tracks.manyTrack.maxTasks);
  });
  it("깊게가 강제된 경우 규모 초과는 불일치가 아니다 — 애초에 다작이 아니다", () => {
    const r = recommendTrack({ tracks, scope: big, model: { ...indie, platform: "roblox" } });
    expect(mis(r)).not.toContain("scope-over-budget");
  });
  it("정합하면 불일치가 비어 있다", () => {
    expect(recommendTrack({ tracks, scope: small, model: indie }).mismatches).toEqual([]);
  });
});
