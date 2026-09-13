// 라이브 운영의 조종간인 원격 설정 자체를 아무도 안 봤다. 원격으로 바뀌고, 관찰이 어렵고,
// 틀리면 몇 주 동안 아무도 모른다. ToonTone 헌법 원칙 IV 에서 채굴했다 —
// 그 주석에 실제 사고 이력이 적혀 있다: 번들 기본값에 키를 넣어 하위 폴백이 죽었고
// 접이식 배너가 전 등급 영구 OFF 가 됐다.
import { describe, it, expect } from "vitest";
import { loadConfigClasses, checkRemoteConfig } from "../../plugins/nereus-game/lib/remote-config-check.mjs";

const codes = (r: any) => r.violations.map((v: any) => v.code);
const of = (r: any, code: string) => r.violations.filter((v: any) => v.code === code);

describe("remote-config.json — 분류 체계는 데이터다", () => {
  it("분류가 둘 이상이고 각각 bundleSafe 와 이유를 갖는다", () => {
    const classes = loadConfigClasses();
    expect(Object.keys(classes).length).toBeGreaterThanOrEqual(2);
    for (const [name, c] of Object.entries<any>(classes)) {
      expect(typeof c.bundleSafe, name).toBe("boolean");
      expect(String(c.why ?? "").length, name).toBeGreaterThan(20);
    }
  });

  it("bundleSafe 가 false 인 분류가 있다 — 전부 안전하면 검사할 것이 없다", () => {
    expect(Object.values<any>(loadConfigClasses()).some((c) => c.bundleSafe === false)).toBe(true);
  });
});

// 분류 체계를 직접 준다. 기본 체계가 바뀌어도 이 테스트들이 흔들리지 않는다.
const classes = {
  darkShipped: { bundleSafe: false, why: "미발행이면 기능이 존재하지 않아야 한다. 번들 기본값이 있으면 발행 전에 켜진다." },
  builtInGoverns: { bundleSafe: false, why: "미설정이면 하위 계층(등급 표·플레이버·정책 상수)이 결정한다. 번들 기본값이 있으면 그 계층이 조용히 죽는다." },
  safeDefaultOn: { bundleSafe: true, why: "미설정이면 보호가 켜져야 한다. 번들 기본값이 바로 그 보호값이다." },
  clampedFloor: { bundleSafe: true, why: "미설정이면 안전 하한으로 조인다. 번들 기본값이 하한 자체다." },
};

describe("checkRemoteConfig — 합집합과 배타", () => {
  it("분류되지 않은 키를 잡는다 — 어떤 폴백이 적용될지 아무도 모르는 키다", () => {
    const r = checkRemoteConfig({
      classes,
      declared: ["a_key", "b_key"],
      classified: { safeDefaultOn: ["a_key"] },
    });
    expect(of(r, "unclassified").map((v: any) => v.key)).toEqual(["b_key"]);
  });

  it("유령 키를 **다른 코드로** 잡는다 — 다른 사고다", () => {
    const r = checkRemoteConfig({
      classes,
      declared: ["a_key"],
      classified: { safeDefaultOn: ["a_key", "ghost_key"] },
    });
    expect(of(r, "phantom").map((v: any) => v.key)).toEqual(["ghost_key"]);
    expect(codes(r)).not.toContain("unclassified");
  });

  it("두 분류에 걸친 키를 잡고 어느 분류인지 낸다", () => {
    const r = checkRemoteConfig({
      classes,
      declared: ["a_key"],
      classified: { safeDefaultOn: ["a_key"], clampedFloor: ["a_key"] },
    });
    const v = of(r, "multi-class")[0];
    expect(v.key).toBe("a_key");
    expect(v.classes.sort()).toEqual(["clampedFloor", "safeDefaultOn"]);
  });

  it("일치하면 깨끗하다", () => {
    const r = checkRemoteConfig({
      classes,
      declared: ["a_key", "b_key"],
      classified: { safeDefaultOn: ["a_key"], clampedFloor: ["b_key"] },
    });
    expect(r.violations).toEqual([]);
  });

  it("알 수 없는 분류 이름은 던진다 — 조용히 무시하면 그 키들이 검사되지 않는다", () => {
    expect(() =>
      checkRemoteConfig({ classes, declared: ["a_key"], classified: { nope: ["a_key"] } }),
    ).toThrow(/nope/);
  });
});

describe("checkRemoteConfig — 번들 안전 (실제 사고를 낸 항목)", () => {
  const base = { classes, declared: ["dark_key", "safe_key"], classified: { darkShipped: ["dark_key"], safeDefaultOn: ["safe_key"] } };

  it("하위 폴백을 죽이는 키가 번들에 있으면 잡는다", () => {
    const r = checkRemoteConfig({ ...base, bundleDefaults: ["dark_key"] });
    const v = of(r, "bundle-unsafe")[0];
    expect(v.key).toBe("dark_key");
    expect(v.class).toBe("darkShipped");
    expect(String(v.why).length).toBeGreaterThan(20);
  });

  it("안전한 분류의 키는 번들에 있어도 된다", () => {
    expect(codes(checkRemoteConfig({ ...base, bundleDefaults: ["safe_key"] }))).not.toContain("bundle-unsafe");
  });

  it("번들 기본값을 안 주면 그 검사를 건너뛴다", () => {
    expect(codes(checkRemoteConfig(base))).not.toContain("bundle-unsafe");
  });

  it("심각도를 나눈다 — 같은 무게로 보고하면 진짜가 묻힌다", () => {
    const r = checkRemoteConfig({
      classes,
      declared: ["dark_key", "lost_key"],
      classified: { darkShipped: ["dark_key"] },
      bundleDefaults: ["dark_key"],
    });
    expect(of(r, "bundle-unsafe")[0].severity).toBe("incident");
    expect(of(r, "unclassified")[0].severity).toBe("trust");
  });

  it("번들에만 있고 선언에 없는 키도 유령이다", () => {
    const r = checkRemoteConfig({ ...base, bundleDefaults: ["nowhere_key"] });
    expect(of(r, "phantom").map((v: any) => v.key)).toContain("nowhere_key");
  });
});

describe("checkRemoteConfig — 이름 규칙", () => {
  it("기본 패턴은 snake_case 다", () => {
    const r = checkRemoteConfig({
      classes,
      declared: ["adInterstitialFrequency"],
      classified: { safeDefaultOn: ["adInterstitialFrequency"] },
    });
    expect(of(r, "key-pattern").map((v: any) => v.key)).toEqual(["adInterstitialFrequency"]);
  });

  it("패턴은 데이터다", () => {
    const r = checkRemoteConfig({
      classes,
      declared: ["adInterstitialFrequency"],
      classified: { safeDefaultOn: ["adInterstitialFrequency"] },
      keyPattern: "^[a-z][A-Za-z0-9]*$",
    });
    expect(codes(r)).not.toContain("key-pattern");
  });

  it("이유 없는 분류는 던진다", () => {
    expect(() =>
      checkRemoteConfig({ classes: { x: { bundleSafe: true } }, declared: [], classified: {} }),
    ).toThrow(/why/i);
  });
});
