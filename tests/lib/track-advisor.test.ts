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
    // 반환 키는 더 늘 수 있다(matched·checkboxes). 정확 형태가 아니라 세는 값만 고정한다.
    expect(countScope("")).toMatchObject({ tasks: 0, flows: 0 });
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

// ── 실측 회귀 (ToonTone, 2026-09-13) ─────────────────────────────────────────
// 하네스를 실제 게임에 처음 붙였을 때 태스크 188개를 0개로 셌다. spec-kit 이 내는
// 형식에 번호 뒤 마침표가 없기 때문이다. 픽스처를 하네스 자신의 출력 형식으로 썼기 때문에
// 기존 테스트는 전부 초록이었다 — 아래 줄들은 ToonTone 산출물에서 그대로 뜬 것이다.
// 저장소를 읽지 않고 리터럴로 박는다. 읽으면 없을 때 조용히 건너뛰는 테스트가 된다.
describe("countScope — 실제 산출물 형식", () => {
  const SPEC_KIT = "- [x] T001 Flutter 프로젝트를 저장소 루트에 생성한다\n- [ ] T002 pubspec.yaml 에 의존성을 추가한다\n";

  it("spec-kit 형식(마침표 없음)을 센다", () => {
    const s = countScope(SPEC_KIT);
    expect(s.tasks).toBe(2);
    expect(s.matched).toBe("spec-kit");
  });

  it("nereus:spec 형식을 세고 그렇게 표시한다", () => {
    const s = countScope("- [ ] T1. 무언가를 한다\n");
    expect(s.tasks).toBe(1);
    expect(s.matched).toBe("nereus");
  });

  it("spec-kit 형식에서도 flow 를 센다", () => {
    expect(countScope("- [x] T001 로그인 흐름 [flow]\n- [ ] T002 그 밖\n").flows).toBe(1);
  });

  // spec-kit 은 태스크를 끼워 넣을 때 번호에 접미 문자를 붙인다. ToonTone 에 5개 있었다.
  it("spec-kit 의 접미 번호(T042a)도 태스크다", () => {
    const s = countScope("- [x] T042 원래 태스크\n- [x] T042a 끼워 넣은 태스크\n");
    expect(s.tasks).toBe(2);
    expect(s.matched).toBe("spec-kit");
  });

  it("어떤 형식도 못 알아보면 0 이 아니라 null 로 말한다", () => {
    const s = countScope("- [ ] 그냥 항목\n- [x] 또 하나\n");
    expect(s.tasks).toBe(0);
    expect(s.matched).toBeNull();
    expect(s.checkboxes).toBe(2);
  });

  it("빈 내용은 태스크가 없는 것이지 형식 미상이 아니다", () => {
    expect(countScope("").matched).toBeNull();
    expect(countScope("").checkboxes).toBe(0);
  });
});

describe("recommendTrack — 형식을 못 알아봤을 때", () => {
  it("규모 임계 비교를 하지 않고 모른다고 말한다", () => {
    const scope = { tasks: 0, flows: 0, matched: null, checkboxes: 188 };
    const r = recommendTrack({ tracks, scope, model: indie });
    expect(codes(r)).toContain("scope-unknown");
    expect(codes(r)).not.toContain("scope-exceeds-many");
  });

  it("강제 조건은 형식과 무관하게 그대로 나온다", () => {
    const scope = { tasks: 0, flows: 0, matched: null, checkboxes: 188 };
    const r = recommendTrack({ tracks, scope, model: { ...indie, platform: "roblox" } });
    expect(r.recommendation).toBe("deep");
    expect(codes(r)).toContain("platform-roblox");
  });

  it("형식을 알아본 경우에는 scope-unknown 이 없다", () => {
    expect(codes(recommendTrack({ tracks, scope: { ...small, matched: "nereus" }, model: indie }))).not.toContain("scope-unknown");
  });
});
