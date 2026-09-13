// 다작론의 핵심 코드 규율. ToonTone 헌법 원칙 VI 에서 채굴했다:
// "Dart source MUST be identical across every flavor. 어떤 형태든 `if flavor == X` 는 위반이다."
// 근거: "The business model is app volume. The moment flavors diverge in code,
//        the marginal cost of a new app stops being near zero and the model collapses."
// track 스킬은 트랙을 추천만 하고 이 규율이 없었다.
import { describe, it, expect } from "vitest";
import { checkParity } from "../../plugins/nereus-game/lib/parity-check.mjs";

const flavors = ["flags", "skz", "boynextdoor"];
const src = (text: string, file = "lib/features/play_page.dart") => [{ file, text }];

describe("checkParity — 분기를 찾는다", () => {
  it("플레이버 분기를 잡는다", () => {
    const r = checkParity({ flavors, sources: src('  if (flavor == "skz") {\n') });
    expect(r.applicable).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]).toMatchObject({ code: "flavor-branch", file: "lib/features/play_page.dart", line: 1 });
  });

  it("식별자를 다루는 것 자체는 위반이 아니다 — 설정을 읽는 코드는 당연히 id 를 만진다", () => {
    expect(checkParity({ flavors, sources: src("  final id = config.flavorId;\n") }).violations).toEqual([]);
    expect(checkParity({ flavors, sources: src("  load(flavorId);\n") }).violations).toEqual([]);
  });

  it("switch 분기도 잡는다", () => {
    expect(checkParity({ flavors, sources: src("  switch (flavor) {\n") }).violations).toHaveLength(1);
  });

  it("!= 와 === 도 비교다", () => {
    expect(checkParity({ flavors, sources: src('  if (flavorId != "flags") return;\n') }).violations).toHaveLength(1);
    expect(checkParity({ flavors, sources: src("  if (flavor === 'skz') {\n") }).violations).toHaveLength(1);
  });

  it("주석 줄은 위반이 아니다", () => {
    expect(checkParity({ flavors, sources: src('  // if (flavor == "skz") 였던 것을 설정으로 올렸다\n') }).violations).toEqual([]);
  });

  it("식별자 이름은 데이터다 — 프로젝트마다 다르다", () => {
    const opts = { flavors, identifiers: ["variant"] };
    expect(checkParity({ ...opts, sources: src('  if (variant == "a") {\n') }).violations).toHaveLength(1);
    expect(checkParity({ ...opts, sources: src('  if (flavor == "a") {\n') }).violations).toEqual([]);
  });

  // ToonTone 실측: 아래 네 줄이 전부 오탐으로 잡혔다. 진짜 규칙은 "식별자가 비교에 쓰인다"가
  // 아니라 **"플레이버 리터럴로 동작이 갈린다"** 이다. 널 검사·타입 검사·변수 대 변수는
  // 갈리는 게 아니라 같은 코드가 모든 플레이버에서 도는 모습이다.
  it("변수 대 변수 비교는 분기가 아니다", () => {
    expect(checkParity({ flavors, sources: src("  if (expected != null && pack.flavorId != expected) {\n") }).violations).toEqual([]);
    expect(checkParity({ flavors, sources: src("  if (flavorId != pack.flavorId) return null;\n") }).violations).toEqual([]);
  });

  it("널 검사는 분기가 아니다", () => {
    expect(checkParity({ flavors, sources: src("  if (flavor == null || packageName == null) {\n") }).violations).toEqual([]);
  });

  it("타입 검사는 분기가 아니다", () => {
    expect(checkParity({ flavors, sources: src("  if (kindName is! String || flavorId is! String) return null;\n") }).violations).toEqual([]);
  });

  it("알려진 플레이버 리터럴이면 확실한 분기다", () => {
    const r = checkParity({ flavors, sources: src('  if (flavor == "skz") {\n') });
    expect(r.violations[0].literal).toBe("skz");
    expect(r.violations[0].known).toBe(true);
  });

  it("목록에 없는 문자열 리터럴도 잡는다 — 플레이버 목록이 최신이 아닐 수 있다", () => {
    const r = checkParity({ flavors, sources: src('  if (flavor == "newone") {\n') });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].known).toBe(false);
  });

  it("여러 위반의 줄 번호가 맞다", () => {
    const r = checkParity({ flavors, sources: src('  final a = 1;\n  if (flavor == "skz") {\n  }\n  switch (flavorId) {\n') });
    expect(r.violations.map((v: any) => v.line)).toEqual([2, 4]);
  });

  it("위반에 이유가 실려 있다", () => {
    const r = checkParity({ flavors, sources: src('  if (flavor == "skz") {\n') });
    expect(String(r.violations[0].why).length).toBeGreaterThan(20);
  });
});

describe("checkParity — 플레이버가 없으면 해당 없음이다", () => {
  it("깊게 트랙에는 플레이버가 없다 — 위반 0 이 아니라 applicable false 다", () => {
    const r = checkParity({ flavors: [], sources: src('  if (flavor == "skz") {\n') });
    expect(r.applicable).toBe(false);
    expect(r.violations).toEqual([]);
    expect(String(r.why).length).toBeGreaterThan(20);
  });

  it("flavors 를 아예 안 주어도 해당 없음이다", () => {
    expect(checkParity({ sources: src('  if (flavor == "skz") {\n') }).applicable).toBe(false);
  });

  it("플레이버가 하나뿐이면 아직 다작이 아니다", () => {
    expect(checkParity({ flavors: ["flags"], sources: src('  if (flavor == "skz") {\n') }).applicable).toBe(false);
  });

  it("둘 이상이면 검사한다", () => {
    expect(checkParity({ flavors: ["a", "b"], sources: src("  final x = 1;\n") }).applicable).toBe(true);
  });
});
