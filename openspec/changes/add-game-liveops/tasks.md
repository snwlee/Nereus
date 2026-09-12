# tasks — add-game-liveops

- [x] T1. 로케일 집합을 데이터로 선언하고 로더를 만든다 [wave:1]
  - Files: Create `plugins/nereus-game/locales.json` · Create `plugins/nereus-game/lib/locales.mjs` · Test `tests/lib/locales.test.ts`
  - Interfaces: Produces `loadLocales(deps): LocaleData` · `localeIds(data): string[]` · `expansionOf(data, id): number`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/locales.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { loadLocales, localeIds, expansionOf } from "../../plugins/nereus-game/lib/locales.mjs";

      describe("locales", () => {
        it("로블록스 상위 시장 8종을 데이터로 선언한다", () => {
          const ids = localeIds(loadLocales());
          expect(ids).toEqual(expect.arrayContaining(["en", "ko", "ja", "pt-BR", "es", "zh", "fr", "de"]));
        });
        it("기준 로케일이 목록 안에 있다", () => {
          const d = loadLocales();
          expect(localeIds(d)).toContain(d.base);
        });
        it("독일어는 영어보다 길어지고 일본어는 짧아진다", () => {
          const d = loadLocales();
          expect(expansionOf(d, "de")).toBeGreaterThan(1);
          expect(expansionOf(d, "ja")).toBeLessThan(1);
        });
        it("알 수 없는 로케일은 기본값으로 떨어지지 않고 던진다", () => {
          expect(() => expansionOf(loadLocales(), "kl")).toThrow(/알 수 없는 로케일/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/locales.test.ts` · Expected: FAIL (locales.mjs 없음)
    - [x] `plugins/nereus-game/locales.json` 작성. 확장률은 추정치이며 출처를 `note` 로 남긴다:
      ```json
      {
        "base": "en",
        "note": "expansion 은 영어 대비 평균 문자열 길이 비의 업계 통념 추정치다. 실측이 생기면 이 파일만 고친다.",
        "locales": {
          "en": { "label": "English", "expansion": 1.0 },
          "ko": { "label": "한국어", "expansion": 0.8 },
          "ja": { "label": "日本語", "expansion": 0.6 },
          "pt-BR": { "label": "Português (Brasil)", "expansion": 1.3 },
          "es": { "label": "Español", "expansion": 1.25 },
          "zh": { "label": "中文", "expansion": 0.6 },
          "fr": { "label": "Français", "expansion": 1.3 },
          "de": { "label": "Deutsch", "expansion": 1.35 }
        }
      }
      ```
    - [x] `plugins/nereus-game/lib/locales.mjs` 작성:
      ```js
      // 대상 언어 집합은 코드가 아니라 데이터다. 검사기 안에 목록을 박으면
      // 시장이 바뀔 때마다 검사기를 고쳐야 한다. 장르 프로파일과 같은 이유다.
      import fs from "node:fs";
      import path from "node:path";
      import { fileURLToPath } from "node:url";

      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const FILE = path.join(HERE, "..", "locales.json");
      const defaultDeps = { readJson: (p) => JSON.parse(fs.readFileSync(p, "utf8")) };

      export function loadLocales(deps = defaultDeps) {
        const raw = deps.readJson(FILE);
        if (!raw || typeof raw.base !== "string" || !raw.locales || typeof raw.locales !== "object") {
          throw new Error("locales.json 이 base 와 locales 를 갖고 있지 않다");
        }
        if (!(raw.base in raw.locales)) throw new Error(`기준 로케일 ${raw.base} 가 locales 에 없다`);
        return raw;
      }

      export function localeIds(data) {
        return Object.keys(data?.locales ?? {});
      }

      export function expansionOf(data, id) {
        const entry = data?.locales?.[id];
        if (!entry) throw new Error(`알 수 없는 로케일: ${id} (있는 것: ${localeIds(data).join(", ")})`);
        const n = Number(entry.expansion);
        if (!Number.isFinite(n) || n <= 0) throw new Error(`로케일 ${id} 의 expansion 이 수치가 아니다`);
        return n;
      }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/lib/locales.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/locales.json plugins/nereus-game/lib/locales.mjs tests/lib/locales.test.ts && git commit -m "feat(game): 대상 로케일 집합을 데이터로 선언한다"`
  - Done when: 8개 로케일이 `localeIds` 에 나오고, 알 수 없는 로케일이 예외를 던지며, `npx vitest run tests/lib/locales.test.ts` 가 통과한다

- [x] T2. 오디오 예산·피드백 커버리지 검사기를 만든다 [wave:1]
  - Files: Create `plugins/nereus-game/lib/sound-budget.mjs` · Test `tests/lib/sound-budget.test.ts`
  - Interfaces: Produces `checkSound({ profile, plan }): { violations: Array }`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/sound-budget.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { checkSound } from "../../plugins/nereus-game/lib/sound-budget.mjs";

      const profile = { sound: { maxConcurrent: 16, minVariants: 2, loudnessLufs: [-16, -12] } };
      const codes = (r: any) => r.violations.map((v: any) => v.code);

      describe("sound budget", () => {
        it("프로파일에 sound 기준이 없으면 통과가 아니라 no-baseline 이다", () => {
          const r = checkSound({ profile: {}, plan: { maxConcurrent: 4, cues: [], actions: [] } });
          expect(codes(r)).toEqual(["no-baseline"]);
        });
        it("동시 발음수가 상한을 넘으면 concurrency", () => {
          const r = checkSound({ profile, plan: { maxConcurrent: 32, cues: [], actions: [] } });
          expect(codes(r)).toContain("concurrency");
        });
        it("변형이 모자라면 큐 이름과 함께 variants", () => {
          const plan = { maxConcurrent: 8, cues: [{ name: "jump", variants: 1, actions: ["jump"] }], actions: ["jump"] };
          const r = checkSound({ profile, plan });
          expect(codes(r)).toContain("variants");
          expect(r.violations.find((v: any) => v.code === "variants").cue).toBe("jump");
        });
        it("라우드니스가 목표 범위 밖이면 loudness", () => {
          const plan = { maxConcurrent: 8, loudnessLufs: -6, cues: [], actions: [] };
          expect(codes(checkSound({ profile, plan }))).toContain("loudness");
        });
        it("어떤 큐에도 매핑되지 않은 동작은 no-feedback", () => {
          const plan = { maxConcurrent: 8, cues: [{ name: "jump", variants: 3, actions: ["jump"] }], actions: ["jump", "land"] };
          const r = checkSound({ profile, plan });
          expect(codes(r)).toContain("no-feedback");
          expect(r.violations.find((v: any) => v.code === "no-feedback").action).toBe("land");
        });
        it("기준을 전부 만족하면 위반이 없다", () => {
          const plan = { maxConcurrent: 8, loudnessLufs: -14, cues: [{ name: "jump", variants: 3, actions: ["jump"] }], actions: ["jump"] };
          expect(checkSound({ profile, plan }).violations).toEqual([]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/sound-budget.test.ts` · Expected: FAIL (sound-budget.mjs 없음)
    - [x] `plugins/nereus-game/lib/sound-budget.mjs` 작성:
      ```js
      // 오디오 예산 검사기. asset 이 소리를 만들고, 여기서는 그 소리를 어떻게 쓰는지만 본다.
      // 체크리스트가 아니라 수치다 — 그래야 게이트가 사람 판단에 의존하지 않는다.
      export function checkSound({ profile, plan } = {}) {
        const base = profile?.sound;
        // 기준이 없으면 통과시키지 않는다. 조용한 통과가 없는 게이트보다 나쁘다.
        if (!base || typeof base !== "object") return { violations: [{ code: "no-baseline" }] };

        const violations = [];
        const cues = Array.isArray(plan?.cues) ? plan.cues : [];
        const actions = Array.isArray(plan?.actions) ? plan.actions : [];

        const max = Number(base.maxConcurrent);
        const used = Number(plan?.maxConcurrent);
        if (Number.isFinite(max) && Number.isFinite(used) && used > max) {
          violations.push({ code: "concurrency", used, max });
        }

        const minVariants = Number(base.minVariants);
        if (Number.isFinite(minVariants)) {
          for (const cue of cues) {
            const n = Number(cue?.variants) || 0;
            if (n < minVariants) violations.push({ code: "variants", cue: cue?.name ?? "", variants: n, min: minVariants });
          }
        }

        const range = base.loudnessLufs;
        const lufs = Number(plan?.loudnessLufs);
        if (Array.isArray(range) && range.length === 2 && Number.isFinite(lufs) && (lufs < range[0] || lufs > range[1])) {
          violations.push({ code: "loudness", lufs, range: [range[0], range[1]] });
        }

        const covered = new Set(cues.flatMap((c) => (Array.isArray(c?.actions) ? c.actions : [])));
        for (const a of actions) {
          if (!covered.has(a)) violations.push({ code: "no-feedback", action: a });
        }

        return { violations };
      }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/lib/sound-budget.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/sound-budget.mjs tests/lib/sound-budget.test.ts && git commit -m "feat(game): 오디오 예산·피드백 커버리지 검사기"`
  - Done when: 6개 시나리오가 전부 통과하고, 기준 없는 프로파일이 `no-baseline` 을 낸다

- [x] T3. 라이브옵스 계획 정합성 검사기를 만든다 [wave:1]
  - Files: Create `plugins/nereus-game/lib/liveops-plan.mjs` · Test `tests/lib/liveops-plan.test.ts`
  - Interfaces: Produces `checkLiveops({ profile, plan, metrics }): { violations: Array, unmeasured: string[] }`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/liveops-plan.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { checkLiveops } from "../../plugins/nereus-game/lib/liveops-plan.mjs";

      const profile = { liveops: { retentionDriftPct: 20 } };
      const ev = (name: string, start: number, end: number, rollback = "flag off") => ({ name, start, end, rollback });
      const okPlan = {
        events: [ev("halloween", 1, 5), ev("winter", 6, 9)],
        economy: { sources: [{ name: "quest", amount: 100 }], sinks: [{ name: "shop", amount: 90 }] },
        retention: { d1: 0.4, d7: 0.2, d30: 0.1 },
      };
      const codes = (r: any) => r.violations.map((v: any) => v.code);

      describe("liveops plan", () => {
        it("정합한 계획에는 위반이 없다", () => {
          expect(checkLiveops({ profile, plan: okPlan }).violations).toEqual([]);
        });
        it("이벤트 구간이 겹치면 overlap", () => {
          const plan = { ...okPlan, events: [ev("a", 1, 5), ev("b", 4, 8)] };
          const r = checkLiveops({ profile, plan });
          expect(codes(r)).toContain("overlap");
          expect(r.violations.find((v: any) => v.code === "overlap").events).toEqual(["a", "b"]);
        });
        it("구간이 닿기만 하면 겹침이 아니다", () => {
          const plan = { ...okPlan, events: [ev("a", 1, 5), ev("b", 5, 8)] };
          expect(codes(checkLiveops({ profile, plan }))).not.toContain("overlap");
        });
        it("소스만 있고 싱크가 없으면 no-sink", () => {
          const plan = { ...okPlan, economy: { sources: [{ name: "quest", amount: 100 }], sinks: [] } };
          expect(codes(checkLiveops({ profile, plan }))).toContain("no-sink");
        });
        it("리텐션이 뒤로 갈수록 올라가면 retention-shape", () => {
          const plan = { ...okPlan, retention: { d1: 0.2, d7: 0.4, d30: 0.1 } };
          expect(codes(checkLiveops({ profile, plan }))).toContain("retention-shape");
        });
        it("롤백 선언이 없는 이벤트는 no-rollback", () => {
          const plan = { ...okPlan, events: [{ name: "halloween", start: 1, end: 5 }] };
          const r = checkLiveops({ profile, plan });
          expect(codes(r)).toContain("no-rollback");
          expect(r.violations.find((v: any) => v.code === "no-rollback").event).toBe("halloween");
        });
        it("지표가 없으면 그 항목만 unmeasured 로 남고 나머지는 판정한다", () => {
          const r = checkLiveops({ profile, plan: okPlan });
          expect(r.unmeasured).toContain("retention-actual");
          expect(r.violations).toEqual([]);
        });
        it("지표를 주입하면 편차를 판정하고 unmeasured 가 비워진다", () => {
          const r = checkLiveops({ profile, plan: okPlan, metrics: { retention: { d1: 0.2, d7: 0.1, d30: 0.05 } } });
          expect(codes(r)).toContain("retention-drift");
          expect(r.unmeasured).toEqual([]);
        });
        it("가정과 가까운 실측이면 편차 위반이 없다", () => {
          const r = checkLiveops({ profile, plan: okPlan, metrics: { retention: { d1: 0.38, d7: 0.19, d30: 0.1 } } });
          expect(codes(r)).not.toContain("retention-drift");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/liveops-plan.test.ts` · Expected: FAIL (liveops-plan.mjs 없음)
    - [x] `plugins/nereus-game/lib/liveops-plan.mjs` 작성:
      ```js
      // 라이브옵스 계획 검사기.
      //
      // 실제 운영 지표는 아직 없다. 그래도 **계획의 내적 정합성**은 지금 판정할 수 있다 —
      // 구간 겹침 · 싱크/소스 균형 · 리텐션 곡선 형태 · 롤백 경로 존재는 지표와 무관하다.
      // 지표가 필요한 항목만 unmeasured 로 남긴다. 미설정과 실패를 구분한다.
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
              if (driftPct > allow) { violations.push({ code: "retention-drift", day: d, want, got }); }
            }
          }
        }

        return { violations, unmeasured };
      }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/lib/liveops-plan.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/liveops-plan.mjs tests/lib/liveops-plan.test.ts && git commit -m "feat(game): 라이브옵스 계획 정합성 검사기 (지표는 주입구)"`
  - Done when: 9개 시나리오가 전부 통과하고, 지표 없이도 정합성 항목이 판정되며 `unmeasured` 에 `retention-actual` 이 남는다

- [x] T4. 현지화 검사기를 만든다
  - Files: Create `plugins/nereus-game/lib/l10n-scan.mjs` · Test `tests/lib/l10n-scan.test.ts`
  - Interfaces: Consumes `loadLocales(deps): LocaleData` · `expansionOf(data, id): number` (T1) · Produces `scanL10n({ locales, base, tables, sources, maxWidth, accessor }): { violations: Array }`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/l10n-scan.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { scanL10n } from "../../plugins/nereus-game/lib/l10n-scan.mjs";
      import { loadLocales } from "../../plugins/nereus-game/lib/locales.mjs";

      const locales = loadLocales();
      const codes = (r: any) => r.violations.map((v: any) => v.code);

      describe("l10n scan", () => {
        it("문자열 테이블을 거치지 않은 사용자 노출 문자열은 hardcoded", () => {
          const sources = [{ file: "src/hud.luau", text: 'label.Text = "Press to jump"\n' }];
          const r = scanL10n({ locales, tables: { en: {} }, sources });
          expect(codes(r)).toContain("hardcoded");
          expect(r.violations[0].file).toBe("src/hud.luau");
          expect(r.violations[0].line).toBe(1);
        });
        it("접근자를 거친 문자열은 걸리지 않는다", () => {
          const sources = [{ file: "src/hud.luau", text: 'label.Text = L("hud.jump")\n' }];
          expect(codes(scanL10n({ locales, tables: { en: {} }, sources }))).not.toContain("hardcoded");
        });
        it("주석 줄은 걸리지 않는다", () => {
          const sources = [{ file: "src/hud.luau", text: '-- label.Text = "Press to jump"\n' }];
          expect(codes(scanL10n({ locales, tables: { en: {} }, sources }))).not.toContain("hardcoded");
        });
        it("기준 로케일의 키가 다른 로케일에 없으면 missing-key", () => {
          const tables = { en: { "hud.jump": "Jump" }, ko: {} };
          const r = scanL10n({ locales, tables });
          expect(codes(r)).toContain("missing-key");
          const v = r.violations.find((x: any) => x.code === "missing-key");
          expect(v.locale).toBe("ko");
          expect(v.key).toBe("hud.jump");
        });
        it("확장률을 곱해 maxWidth 를 넘으면 overflow", () => {
          const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
          const r = scanL10n({ locales, tables, maxWidth: 9 });
          const v = r.violations.find((x: any) => x.code === "overflow");
          expect(v.locale).toBe("de");
          expect(v.key).toBe("hud.jump");
        });
        it("maxWidth 를 주지 않으면 폭 검사를 하지 않는다", () => {
          const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
          expect(codes(scanL10n({ locales, tables }))).not.toContain("overflow");
        });
        it("알 수 없는 로케일이 테이블에 있으면 던진다", () => {
          expect(() => scanL10n({ locales, tables: { en: {}, kl: {} } })).toThrow(/알 수 없는 로케일/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: FAIL (l10n-scan.mjs 없음)
    - [x] `plugins/nereus-game/lib/l10n-scan.mjs` 작성:
      ```js
      // 현지화 검사기. 번역을 실행하지 않고, 번역하면 깨질 곳을 지금 찾는다.
      // 출시 후에 발견하면 고치는 비용이 몇 배가 된다.
      import { expansionOf, localeIds } from "./locales.mjs";

      // 사용자 노출로 볼 문자열: 한글·CJK 가 있거나, 두 글자 이상 단어 뒤에 공백이 오는 것.
      // 식별자·경로·포맷 토큰을 사용자 문장으로 오인하지 않기 위한 최소 조건이다.
      const USER_FACING = /[가-힣ぁ-んァ-ヶ一-龥]|[A-Za-z]{2,}\s/;
      const LITERAL = /"([^"\n]{2,})"|'([^'\n]{2,})'/g;
      const COMMENT = /^\s*(--|\/\/|#)/;

      export function scanL10n({ locales, base = "", tables = {}, sources = [], maxWidth = 0, accessor = "L(" } = {}) {
        const known = new Set(localeIds(locales));
        for (const id of Object.keys(tables)) {
          // 조용히 건너뛰면 그 로케일이 검사되지 않은 채 통과한다. 던지는 편이 낫다.
          if (!known.has(id)) throw new Error(`알 수 없는 로케일: ${id} (있는 것: ${[...known].join(", ")})`);
        }
        const baseId = base || locales?.base;
        const violations = [];

        for (const src of sources) {
          const lines = String(src?.text ?? "").split("\n");
          lines.forEach((line, i) => {
            if (COMMENT.test(line) || line.includes(accessor)) return;
            for (const m of line.matchAll(LITERAL)) {
              const text = m[1] ?? m[2] ?? "";
              if (USER_FACING.test(text)) violations.push({ code: "hardcoded", file: src?.file ?? "", line: i + 1, text });
            }
          });
        }

        const baseTable = tables[baseId] ?? {};
        for (const id of Object.keys(tables)) {
          if (id === baseId) continue;
          for (const key of Object.keys(baseTable)) {
            if (!(key in tables[id])) violations.push({ code: "missing-key", locale: id, key });
          }
        }

        if (Number(maxWidth) > 0) {
          for (const id of Object.keys(tables)) {
            const rate = expansionOf(locales, id);
            for (const [key, value] of Object.entries(baseTable)) {
              const width = String(value).length * rate;
              if (width > Number(maxWidth)) violations.push({ code: "overflow", locale: id, key, width: Math.round(width * 100) / 100, maxWidth: Number(maxWidth) });
            }
          }
        }

        return { violations };
      }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/l10n-scan.mjs tests/lib/l10n-scan.test.ts && git commit -m "feat(game): 현지화 검사기 — 하드코딩·키 누락·확장률 폭 초과"`
  - Done when: 7개 시나리오가 전부 통과하고, 알 수 없는 로케일이 예외를 던진다

- [x] T5. 장르 프로파일 4종에 sound · liveops · l10n 기준을 덧붙인다
  - Files: Modify `plugins/nereus-game/profiles/sim-tycoon.json` · Modify `plugins/nereus-game/profiles/obby-platformer.json` · Modify `plugins/nereus-game/profiles/battle-pvp.json` · Modify `plugins/nereus-game/profiles/narrative.json` · Test `tests/lib/profiles-domains.test.ts`
  - Interfaces: Consumes `loadProfile(genre, deps): Profile` · `listProfiles(deps): string[]` · Produces 없음 (데이터만 추가)
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/profiles-domains.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { listProfiles, loadProfile, validateProfile } from "../../plugins/nereus-game/lib/profiles.mjs";
      import { checkSound } from "../../plugins/nereus-game/lib/sound-budget.mjs";

      describe("장르 프로파일의 새 도메인 기준", () => {
        it("모든 장르가 sound · liveops · l10n 기준을 갖는다", () => {
          for (const g of listProfiles()) {
            const p = loadProfile(g);
            expect(p.sound, g).toBeTruthy();
            expect(p.liveops, g).toBeTruthy();
            expect(p.l10n, g).toBeTruthy();
          }
        });
        it("sound 기준이 있으므로 어떤 장르도 no-baseline 을 내지 않는다", () => {
          const plan = { maxConcurrent: 1, loudnessLufs: -14, cues: [], actions: [] };
          for (const g of listProfiles()) {
            const r = checkSound({ profile: loadProfile(g), plan });
            expect(r.violations.map((v: any) => v.code), g).not.toContain("no-baseline");
          }
        });
        it("새 키는 선택 키다 — 기존 필수 키 검증을 바꾸지 않는다", () => {
          expect(validateProfile({ genre: "x", loop: [], metrics: [], balance: {} })).toEqual([]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/profiles-domains.test.ts` · Expected: FAIL (프로파일에 sound 키 없음)
    - [x] 네 프로파일 각각에 아래 세 키를 추가한다. 값은 장르마다 다르게 준다 — 오비는 동작이 잦아
      변형이 더 필요하고, 시뮬레이터·타이쿤은 이벤트 주기가 길어 리텐션 편차 허용치가 좁다.
      `sim-tycoon.json` 에 추가:
      ```json
      "sound": { "maxConcurrent": 16, "minVariants": 2, "loudnessLufs": [-16, -12] },
      "liveops": { "retentionDriftPct": 15, "note": "타이쿤은 복리 성장이라 초반 리텐션이 흔들리면 경제 전체가 틀어진다" },
      "l10n": { "maxWidth": 24, "note": "상점·업그레이드 라벨이 좁다" }
      ```
      `obby-platformer.json` 에 추가:
      ```json
      "sound": { "maxConcurrent": 24, "minVariants": 3, "loudnessLufs": [-16, -12] },
      "liveops": { "retentionDriftPct": 25, "note": "오비는 신규 스테이지 투입에 리텐션이 크게 튄다" },
      "l10n": { "maxWidth": 18, "note": "스테이지 이름과 안내가 화면 위에 겹쳐 나온다" }
      ```
      `battle-pvp.json` 에 추가:
      ```json
      "sound": { "maxConcurrent": 32, "minVariants": 3, "loudnessLufs": [-16, -11] },
      "liveops": { "retentionDriftPct": 20, "note": "시즌 경계에서 리텐션이 계단으로 움직인다" },
      "l10n": { "maxWidth": 20, "note": "스킬·아이템 이름이 길어지면 HUD 가 깨진다" }
      ```
      `narrative.json` 에 추가:
      ```json
      "sound": { "maxConcurrent": 12, "minVariants": 2, "loudnessLufs": [-18, -14] },
      "liveops": { "retentionDriftPct": 30, "note": "에피소드 배포 간격이 길어 일 단위 편차가 크다" },
      "l10n": { "maxWidth": 40, "note": "대사창은 넓지만 확장률이 큰 언어에서 줄바꿈이 늘어난다" }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/lib/profiles-domains.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/profiles tests/lib/profiles-domains.test.ts && git commit -m "feat(game): 장르 프로파일에 sound·liveops·l10n 기준을 데이터로 덧붙인다"`
  - Done when: 네 장르 모두 세 키를 갖고, `validateProfile` 의 필수 키는 그대로이며 `npx vitest run tests/lib/profiles-domains.test.ts` 가 통과한다

- [x] T6. 도메인 스킬 3종과 라우트를 배선한다
  - Files: Create `plugins/nereus-game/skills/sound/SKILL.md` · Create `plugins/nereus-game/skills/liveops/SKILL.md` · Create `plugins/nereus-game/skills/localization/SKILL.md` · Modify `plugins/nereus-game/nereus-extension.json`
  - Interfaces: Consumes `checkSound` · `checkLiveops` · `scanL10n` (T2·T3·T4) · Produces routes 3개
  - Steps:
    - [x] 실패 테스트 작성 `tests/smoke/game-domain-liveops.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";

      const ext = JSON.parse(fs.readFileSync("plugins/nereus-game/nereus-extension.json", "utf8"));
      const NEW = ["nereus-game:sound", "nereus-game:liveops", "nereus-game:localization"];

      describe("새 도메인 배선", () => {
        it("세 스킬이 routes 에 선언돼 있다", () => {
          const skills = ext.routes.map((r: any) => r.skill);
          for (const s of NEW) expect(skills).toContain(s);
        });
        it("선언된 route 마다 SKILL.md 가 실재한다 — dangling route 금지", () => {
          for (const r of ext.routes) {
            const name = String(r.skill).split(":")[1];
            expect(fs.existsSync(`plugins/nereus-game/skills/${name}/SKILL.md`), r.skill).toBe(true);
          }
        });
        it("각 SKILL.md 가 자기 검사기를 실제로 부른다 — 선언만 하고 배선 안 하는 것을 막는다", () => {
          const pairs: Array<[string, string]> = [
            ["sound", "sound-budget.mjs"],
            ["liveops", "liveops-plan.mjs"],
            ["localization", "l10n-scan.mjs"],
          ];
          for (const [skill, lib] of pairs) {
            const md = fs.readFileSync(`plugins/nereus-game/skills/${skill}/SKILL.md`, "utf8");
            expect(md, skill).toContain(lib);
          }
        });
        it("도메인 스킬은 엔진에 묶이지 않는다", () => {
          for (const s of NEW) {
            const name = s.split(":")[1];
            const md = fs.readFileSync(`plugins/nereus-game/skills/${name}/SKILL.md`, "utf8");
            expect(md, name).toMatch(/엔진과 무관|엔진 불가지론/);
          }
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL (routes 3개와 SKILL.md 3개가 없음)
    - [x] `plugins/nereus-game/skills/sound/SKILL.md` 작성. frontmatter `name: sound`,
      description 에 트리거 "사운드 설계", "믹스", "오디오 예산" 을 넣고, 본문에
      "**엔진과 무관하다**", asset 과의 경계(생성은 asset·배치는 여기), 그리고
      `node "${CLAUDE_PLUGIN_ROOT}/lib/sound-budget.mjs"` 를 쓰는 검사 절차를 적는다.
    - [x] `plugins/nereus-game/skills/liveops/SKILL.md` 작성. frontmatter `name: liveops`,
      본문에 "**엔진과 무관하다**", 지표 주입구 설명(없으면 unmeasured), 그리고
      `node "${CLAUDE_PLUGIN_ROOT}/lib/liveops-plan.mjs"` 를 쓰는 절차를 적는다.
    - [x] `plugins/nereus-game/skills/localization/SKILL.md` 작성. frontmatter `name: localization`,
      본문에 "**엔진과 무관하다**", `locales.json` 이 언어 집합의 단일 출처라는 점, 그리고
      `node "${CLAUDE_PLUGIN_ROOT}/lib/l10n-scan.mjs"` 를 쓰는 절차를 적는다.
    - [x] `nereus-extension.json` 의 routes 배열 끝에 세 항목을 추가한다:
      ```json
      { "skill": "nereus-game:sound", "why": "사운드 설계·믹스 예산·오디오 피드백", "re": "사운드\\s?설계|믹스|오디오\\s?예산|동시\\s?발음|라우드니스|적응형\\s?음악" },
      { "skill": "nereus-game:liveops", "why": "라이브옵스·이벤트·리텐션·운영", "re": "라이브옵스|liveops|이벤트\\s?캘린더|리텐션|시즌|운영\\s?지표|롤백" },
      { "skill": "nereus-game:localization", "why": "현지화·번역·로케일", "re": "현지화|로컬라이[즈제]이션|localization|l10n|번역|로케일|다국어" }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: PASS
    - [x] 역검증: `nereus-extension.json` 에서 `nereus-game:sound` route 를 임시로 지우고
      Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL. 확인 후 되돌린다.
    - [x] 커밋: `git add plugins/nereus-game/skills plugins/nereus-game/nereus-extension.json tests/smoke/game-domain-liveops.test.ts && git commit -m "feat(game): sound·liveops·localization 스킬과 라우트를 배선한다"`
  - Done when: 세 route 가 선언되고 대응 SKILL.md 가 실재하며, route 를 지우면 테스트가 실패하는 것을 역검증으로 확인했다

- [x] T7. 프로세스 수준 리그로 세 스킬의 라우팅을 확인한다
  - Files: Create `tests/smoke/liveops-rig.test.ts` · Modify `plugins/nereus-game/lib/liveops-plan.mjs` · Modify `plugins/nereus-game/lib/sound-budget.mjs`
  - Interfaces: Consumes `checkLiveops` · `checkSound` (T2·T3) · Produces 실행 진입점 2개 (`node lib/liveops-plan.mjs`, `node lib/sound-budget.mjs`)
  - Steps:
    - [x] 실패 테스트 작성 `tests/smoke/liveops-rig.test.ts`:
      ```ts
      import { describe, it, expect, beforeAll, afterAll } from "vitest";
      import { execFileSync } from "node:child_process";
      import fs from "node:fs";
      import os from "node:os";
      import path from "node:path";

      let home = "";
      beforeAll(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-liveops-")); });
      afterAll(() => { fs.rmSync(home, { recursive: true, force: true }); });

      const runNode = (script: string, input: string) =>
        execFileSync("node", [script], { input, encoding: "utf8", env: { ...process.env, HOME: home } });

      describe("도메인 검사기 실행 진입점", () => {
        it("liveops 검사기를 프로세스로 돌려 위반을 stdout 으로 받는다", () => {
          const plan = { events: [{ name: "a", start: 1, end: 5 }], economy: { sources: [], sinks: [] }, retention: { d1: 0.4, d7: 0.2, d30: 0.1 } };
          const out = runNode("plugins/nereus-game/lib/liveops-plan.mjs", JSON.stringify({ genre: "sim-tycoon", plan }));
          const r = JSON.parse(out);
          expect(r.violations.map((v: any) => v.code)).toContain("no-rollback");
          expect(r.unmeasured).toContain("retention-actual");
        });
        it("sound 검사기를 프로세스로 돌려 위반을 stdout 으로 받는다", () => {
          const plan = { maxConcurrent: 999, loudnessLufs: -14, cues: [], actions: [] };
          const out = runNode("plugins/nereus-game/lib/sound-budget.mjs", JSON.stringify({ genre: "obby-platformer", plan }));
          expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("concurrency");
        });
        it("알 수 없는 장르는 프로세스가 0 이 아닌 코드로 끝난다", () => {
          expect(() => runNode("plugins/nereus-game/lib/sound-budget.mjs", JSON.stringify({ genre: "nope", plan: {} }))).toThrow();
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/liveops-rig.test.ts` · Expected: FAIL (실행 진입점 없음)
    - [x] `plugins/nereus-game/lib/sound-budget.mjs` 상단에 `import { readFileSync } from "node:fs";` 와
      `import { loadProfile } from "./profiles.mjs";` 를 넣고, 파일 끝에 실행 진입점을 붙인다:
      ```js
      // 실행 진입점. stdin 으로 { genre, plan } 을 받아 위반을 JSON 으로 낸다.
      // 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
      function readStdin() {
        try { return readFileSync(0, "utf8"); } catch { return ""; }
      }

      if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
        const input = JSON.parse(readStdin() || "{}");
        const profile = loadProfile(input.genre);
        process.stdout.write(JSON.stringify(checkSound({ profile, plan: input.plan })) + "\n");
        process.exit(0);
      }
      ```
      `loadProfile` 이 알 수 없는 장르에 던지므로, 그때 프로세스는 0 이 아닌 코드로 끝난다.
    - [x] `plugins/nereus-game/lib/liveops-plan.mjs` 에 같은 두 import 를 넣고 파일 끝에 진입점을 붙인다:
      ```js
      function readStdin() {
        try { return readFileSync(0, "utf8"); } catch { return ""; }
      }

      if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
        const input = JSON.parse(readStdin() || "{}");
        const profile = loadProfile(input.genre);
        process.stdout.write(JSON.stringify(checkLiveops({ profile, plan: input.plan, metrics: input.metrics ?? null })) + "\n");
        process.exit(0);
      }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/smoke/liveops-rig.test.ts` · Expected: PASS
    - [x] 전체 확인: Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib tests/smoke/liveops-rig.test.ts && git commit -m "test(game): 도메인 검사기 실행 진입점을 프로세스 수준으로 고정한다"`
  - Done when: 두 검사기가 자식 프로세스로 돌아 JSON 을 내고, 알 수 없는 장르가 0 이 아닌 종료 코드로 끝나며, 전체 스위트가 통과한다

## Global Constraints

- 스택: Node.js ESM (`.mjs`), 테스트는 vitest + TypeScript (`tests/**/*.test.ts`).
- **코어 `plugins/nereus` 를 수정하지 않는다.** 이번 변경은 `plugins/nereus-game` 안에서 끝난다.
- 모든 새 `export` 는 자기 파일 밖에서 참조되거나 실행 진입점에서 쓰여야 한다
  (`tests/smoke/no-unwired-exports.test.ts` 가 문다).
- 장르·로케일처럼 늘어나는 것은 코드가 아니라 데이터로 받는다. 알 수 없는 값은 기본값으로
  떨어지지 않고 던진다.
- 기존 export 의 반환 형태를 바꾸지 않는다. 확장은 새 키·선택 인자로 한다.
- 훅에 `bash` 스크립트를 쓰지 않는다 (메인 개발 환경이 Windows).
- 테스트에서 `NEREUS_HOME` 과 (리그에서는) `HOME` 을 임시 디렉터리로 격리한다.
- 문서·리뷰 파일을 테스트보다 **먼저** 쓴다. 테스트를 마지막에 돌려야 evidence 가 FRESH 로 남는다.
