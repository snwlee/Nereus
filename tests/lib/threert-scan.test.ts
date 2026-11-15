import { describe, it, expect } from "vitest";
import { scanThreeRT, loadThreeRTData } from "../../plugins/nereus-3d/lib/threert-scan.mjs";

const IMPORT = `import { Scene, DirectionalLight, MeshStandardMaterial } from "@threert/scene";\n`;
const scan = (text: string, file = "scene.ts") => scanThreeRT({ sources: [{ file, text }] });
const codes = (r: any) => r.violations.map((v: any) => v.code);
const warns = (r: any) => r.warnings.map((v: any) => v.code);

describe("호환 데이터", () => {
  const data = loadThreeRTData();
  it("출처·커밋·확인일이 있다", () => {
    expect(data.source).toMatch(/^https:\/\//);
    expect(data.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(data.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("모든 규칙에 upstream 파일 근거가 있다", () => {
    const all = ["threert-animation-loop", "threert-info-stub", "threert-setup-nondeterministic",
      "threert-library-field", "threert-ignored-setting", "threert-lux-suspect"];
    for (const c of all) expect(data.evidence[c], c).toMatch(/packages\/|\.claude\//);
  });
});

describe("적용 범위", () => {
  it("@threert 를 import 하지 않으면 적용하지 않는다", () => {
    const r = scan(`renderer.setAnimationLoop(animate);`);
    expect(r.applies).toBe(false);
    expect(r.violations).toEqual([]);
    expect(r.unmeasured.some((u: any) => /@threert/.test(u.what))).toBe(true);
  });
  it("한 소스라도 import 하면 모든 소스를 본다", () => {
    const r = scanThreeRT({ sources: [
      { file: "a.ts", text: IMPORT },
      { file: "b.ts", text: `renderer.setAnimationLoop(animate);` },
    ] });
    expect(r.applies).toBe(true);
    expect(r.violations[0]).toMatchObject({ code: "threert-animation-loop", file: "b.ts", line: 1 });
  });
  it.each([
    `const s = require("@threert/scene");`,
    `const s = await import('@threert/scene');`,
    `export { Scene } from "@threert/scene";`,
    `import "@threert/scene";`,
    "import {\n  Scene,\n} from `@threert/scene`;",
  ])("import 모양마다 적용한다 %#", (line) => {
    expect(scan(line).applies).toBe(true);
  });
  it("주석에만 @threert 가 있으면 적용하지 않는다", () => {
    expect(scan(`// ported from @threert/scene\nrenderer.setAnimationLoop(a);`).applies).toBe(false);
  });
  it("정규식 기반임을 항상 밝힌다", () => {
    expect(scan(IMPORT).unmeasured.some((u: any) => /정규식/.test(u.what))).toBe(true);
  });
});

describe("받고 무시하는 three.js 코드", () => {
  it("setAnimationLoop 콜백은 호출되지 않는다", () => {
    const r = scan(`${IMPORT}renderer.setAnimationLoop(animate);`);
    expect(r.violations[0]).toMatchObject({ code: "threert-animation-loop", line: 2 });
  });
  it.each(["null", " undefined "])("setAnimationLoop(%s) 는 루프를 끄는 것이라 위반이 아니다", (arg) => {
    expect(codes(scan(`${IMPORT}renderer.setAnimationLoop(${arg});`))).toEqual([]);
  });
  it("renderer.info 는 0 고정 스텁이다", () => {
    expect(codes(scan(`${IMPORT}const c = renderer.info.render.calls;`))).toContain("threert-info-stub");
  });
  it("무시되는 설정 대입은 경고다", () => {
    const r = scan(`${IMPORT}renderer.toneMappingExposure = 1.5;\nsun.shadow.mapSize.set(2048, 2048);\nrenderer.shadowMap.enabled = true;`);
    expect(warns(r)).toEqual(["threert-ignored-setting", "threert-ignored-setting", "threert-ignored-setting"]);
    expect(r.violations).toEqual([]);
  });
  it.each([
    "if (renderer.toneMappingExposure === 1) {}",
    "if (light.shadow.bias >= 1) {}",
    "if (renderer.shadowMap.enabled) x = 1;",
  ])("비교·읽기는 대입이 아니다 %#", (line) => {
    expect(warns(scan(`${IMPORT}${line}`))).toEqual([]);
  });
  it.each(["renderer.toneMappingExposure += 1;", "light.shadow.radius++;", "light.shadow.bias -= x;"])(
    "복합 대입·증가도 대입이다 %#",
    (line) => {
      expect(warns(scan(`${IMPORT}${line}`))).toEqual(["threert-ignored-setting"]);
    },
  );
  it("설정마다 맞는 처방을 낸다", () => {
    const r = scan(`${IMPORT}renderer.outputColorSpace = SRGBColorSpace;`);
    expect(r.warnings[0].fix).not.toMatch(/그림자/);
  });
  it("info.programs 는 근거가 없어 잡지 않는다", () => {
    expect(codes(scan(`${IMPORT}renderer.info.programs.length;`))).toEqual([]);
  });
});

describe("setup 결정론", () => {
  it("default export 본문의 Math.random 은 위반이다", () => {
    const r = scan(`${IMPORT}export default function build() {\n  const x = Math.random();\n  return {};\n}`);
    expect(r.violations[0]).toMatchObject({ code: "threert-setup-nondeterministic", line: 3 });
  });
  it("setup 메서드의 Date.now 도 위반이다", () => {
    const r = scan(`${IMPORT}export default defineGame({\n  setup(ctx) {\n    const t = Date.now();\n  },\n});`);
    expect(codes(r)).toContain("threert-setup-nondeterministic");
  });
  // 진입점은 상류의 두 모양뿐이다: 장면의 `export default function build()` 와 게임의 `defineGame({ setup })`.
  it.each([
    "export default function build(): Scene {\n  Math.random();\n}",
    "export default defineGame({\n  setup(ctx: Ctx): { scene: Scene } {\n    Date.now();\n  },\n});",
    "export default function build(): Array<{ a: number }> {\n  Math.random();\n}",
    "export default function build(): { a: 1 } | null {\n  Math.random();\n}",
    "export default async (ctx) => {\n  Math.random();\n};",
    "export default <T,>(ctx: T) => {\n  Math.random();\n};",
    "export default ctx => {\n  Math.random();\n};",
    "export default function build<T extends Array<number>>(ctx: T) {\n  Math.random();\n}",
    "export default function build() {\n  const xs = [1, 2].map(() => Math.random());\n}",
    "export default defineGame<State>({\n  name: \"x\",\n  setup() {\n    Math.random();\n  },\n});",
    "export default defineGame({\n  setup: () => {\n    Math.random();\n  },\n});",
    "const game = defineGame({ setup: (ctx) => ({ seed: Math.random() }) });\nexport default game;",
    "export default defineGame({\n  async setup(ctx) {\n    Math.random();\n  },\n});",
    "export default function build() {\n  const id = crypto.randomUUID();\n}",
    "export default function build() {\n  const d = new Date;\n}",
  ])("진입점 setup 의 비결정성을 잡는다 %#", (body) => {
    expect(codes(scan(`${IMPORT}${body}`))).toEqual(["threert-setup-nondeterministic"]);
  });
  it.each([
    "class TowerManager {\n  build(type) {\n    const id = Math.random();\n  }\n}",
    "class Enemy {\n  setup() {\n    this.phase = Math.random() * 6;\n  }\n}",
    "function build(parts) {\n  return parts.map((p) => ({ ...p, seed: Date.now() }));\n}",
    "const setup = () => ({ id: Math.random() });",
    "export default defineGame({\n  setup: () => {\n    const t0 = performance.now();\n  },\n});",
    "const v = ok ? build(1) : { r: Math.random() };",
    "export default defineGame({\n  handlers: { setup(s) { return Math.random(); } },\n  setup() {},\n});",
    "export default function build(ctx) {\n  ctx.on('tap', () => { Math.random(); });\n  host.addEventListener('x', function () { Date.now(); });\n}",
    "export default function build(ctx) {\n  const onTap = () => spawn(Math.random());\n  function onHit() { return Date.now(); }\n  ctx.on('tap', onTap);\n  ctx.on('hit', onHit);\n}",
  ])("진입점이 아니거나 등록만 하는 콜백은 위반이 아니다 %#", (body) => {
    expect(codes(scan(`${IMPORT}${body}`))).toEqual([]);
  });
  it("@threert 를 직접 import 하지 않는 파일의 default export 는 진입점이 아니다", () => {
    const r = scanThreeRT({ sources: [
      { file: "scene.ts", text: IMPORT },
      { file: "vite.config.ts", text: "export default ({ mode }) => ({ id: Date.now() });" },
      { file: "Hud.tsx", text: "export default function Hud() {\n  const key = Math.random();\n}" },
    ] });
    expect(codes(r)).toEqual([]);
  });
  it.each([
    "export default function build() {\n  const r = new DateRange(a, b);\n}",
    "export default function build() {\n  const t = SimDate.now();\n  const x = FastMath.random();\n}",
  ])("비슷한 이름은 비결정 호출이 아니다 %#", (body) => {
    expect(codes(scan(`${IMPORT}${body}`))).toEqual([]);
  });
  it("래퍼로 정의한 게임은 따라가지 못함을 밝힌다", () => {
    const r = scan(`${IMPORT}export default levelGame({ setup() { Math.random(); } });`);
    expect(codes(r)).toEqual([]);
    expect(r.unmeasured.some((u: any) => /defineGame/.test(u.why))).toBe(true);
  });
  it("핸들러의 Math.random 은 위반이 아니다 — 런타임이 감싼다", () => {
    const r = scan(`${IMPORT}const handlers = {\n  shoot(s) { return Math.random(); },\n};`);
    expect(codes(r)).toEqual([]);
  });
  it("주석·문자열 안은 위반이 아니다", () => {
    const r = scan(`${IMPORT}export default function build() {\n  // Math.random() 금지\n  const s = "Math.random()";\n}`);
    expect(codes(r)).toEqual([]);
  });
});

describe("머티리얼·조명", () => {
  it("표준 머티리얼의 라이브러리 필드는 저장만 된다", () => {
    const r = scan(`${IMPORT}const m = new MeshStandardMaterial({ color: 0xffffff, wet: 0.8, grime: { amount: 1 } });`);
    expect(r.violations[0]).toMatchObject({ code: "threert-library-field", fields: ["wet", "grime"] });
  });
  it("THREE. 네임스페이스와 축약 키도 잡는다", () => {
    const r = scan(`${IMPORT}new THREE.MeshStandardMaterial({ color, wet });\nnew THREE.DirectionalLight(0xffffff, 3);`);
    expect(r.violations[0]).toMatchObject({ code: "threert-library-field", fields: ["wet"] });
    expect(warns(r)).toEqual(["threert-lux-suspect"]);
  });
  it.each([
    [{ luxSuspect: { above: 0.3 } }, /luxSuspect/],
    [{ luxSuspect: { above: 10, atMost: 0.3 } }, /luxSuspect/],
    [{ ignoredSettings: ["toneMapping", ""] }, /ignoredSettings/],
    [{ standardMaterials: [42] }, /standardMaterials/],
    [{ commit: undefined }, /commit/],
  ])("데이터가 깨지면 조용히 끄지 않고 실패한다 %#", (patch, msg) => {
    const data = { ...loadThreeRTData(), ...patch };
    expect(() => scanThreeRT({ sources: [{ file: "a.ts", text: IMPORT }], data })).toThrow(msg);
  });
  it("SurfaceMaterial 의 같은 필드는 정상이다", () => {
    expect(codes(scan(`${IMPORT}new SurfaceMaterial({ wet: 0.8 });`))).toEqual([]);
  });
  it("중첩 객체 안의 같은 이름은 최상위 키가 아니다", () => {
    expect(codes(scan(`${IMPORT}new MeshStandardMaterial({ userData: { wet: 1 } });`))).toEqual([]);
  });
  it("three.js 감각의 lux 는 경고다", () => {
    const r = scan(`${IMPORT}const sun = new DirectionalLight(0xffffff, 3);`);
    expect(r.warnings[0]).toMatchObject({ code: "threert-lux-suspect", value: 3 });
  });
  it.each(["90000", "90_000", "0.2", "1e5"])("%s lux 는 경고가 아니다", (v) => {
    expect(warns(scan(`${IMPORT}new DirectionalLight(0xffffff, ${v});`))).toEqual([]);
  });
});
