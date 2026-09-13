# tasks — add-l10n-harness

`~/workspace/claude-skills/wallpaper-deploy` 와 WallpaperEngineApp 은 **읽기 전용**이다.
이 저장소에 병렬 세션이 붙는다 — 커밋 전 `git log` 를 본다.

- [x] T1. 플러그인 뼈대와 로케일 모듈 이관 + Play 86종
  - Files: Create `plugins/nereus-l10n/.claude-plugin/plugin.json` · Move `plugins/nereus-game/locales.json` · Move `plugins/nereus-game/lib/locales.mjs` · Create `plugins/nereus-l10n/lib/cli-input.mjs` · Modify `.claude-plugin/marketplace.json` · Modify `tests/lib/locales.test.ts`
  - Interfaces: Produces `loadLocales(): { source, checkedAt, howCounted, base, stores, locales }`
  - Steps:
    - [x] **기존 `tests/lib/locales.test.ts` 4케이스를 새 경로로 돌린다. 케이스를 다시 쓰지 않는다** —
          기존 케이스가 이관의 안전망이다. 새로 쓰면 커버리지가 조용히 줄고 줄어든 것이 초록으로 보인다:
      ```bash
      sed -i '' 's|plugins/nereus-game/lib/locales.mjs|plugins/nereus-l10n/lib/locales.mjs|' tests/lib/locales.test.ts
      ```
    - [x] 같은 파일에 86종 확장분을 덧붙인다:
      ```ts
      const BASES = ["legacy-estimate", "group-estimate", "measured"];
      it("Play 로케일이 86종이고 각각 코드·라벨·스크립트·방향을 갖는다", () => {
        const d = loadLocales();
        const play = Object.entries(d.locales).filter(([, v]: any) => v.stores.includes("play"));
        expect(play.length).toBe(86);
        for (const [code, v] of play as any) {
          expect(v.label, code).toBeTruthy();
          expect(v.script, code).toBeTruthy();
          expect(["ltr", "rtl"], code).toContain(v.direction);
        }
      });
      it("셈의 근거가 데이터에 있다", () => {
        const d = loadLocales();
        expect(d.source).toMatch(/^https:\/\//);
        expect(d.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(d.howCounted).toMatch(/86/);
      });
      it("추정값은 근거를 필드마다 갖는다", () => {
        const d = loadLocales();
        for (const [code, v] of Object.entries(d.locales) as any) {
          expect(BASES, `${code}.expansionBasis`).toContain(v.expansionBasis);
          expect(BASES, `${code}.avgCharWidthBasis`).toContain(v.avgCharWidthBasis);
        }
      });
      it("전각 스크립트는 확장률이 작아도 자폭이 크다 — 두 축을 섞지 않는다", () => {
        const d = loadLocales();
        const ko = d.locales["ko-KR"];
        expect(ko.expansion).toBeLessThan(1);
        expect(ko.avgCharWidth).toBeGreaterThan(d.locales["en-US"].avgCharWidth);
      });
      it("RTL 로케일이 방향으로 구분된다", () => {
        const d = loadLocales();
        const rtl = Object.entries(d.locales).filter(([, v]: any) => v.direction === "rtl").map(([c]) => c);
        expect(rtl).toContain("ar");
        expect(rtl).toContain("iw-IL");
        expect(rtl.length).toBeGreaterThanOrEqual(7);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/locales.test.ts` · Expected: FAIL (모듈 없음)
    - [x] `plugin.json` 을 쓴다: name `nereus-l10n`, version `0.1.0`, license `MIT`.
    - [x] `locales.json` 을 쓴다. 86종은 아래 명령으로 뽑은 목록을 쓴다 — 요약 모델로 세지 않는다:
      ```bash
      curl -sL -A "Mozilla/5.0" "https://support.google.com/googleplay/android-developer/answer/9844778?hl=en" \
        | python3 -c "import sys,re,html; t=html.unescape(re.sub(r'<[^>]+>','\n',sys.stdin.read())); ls=[l.strip() for l in t.split('\n') if l.strip()]; s=next(i for i,l in enumerate(ls) if l.startswith('Afrikaans')); e=max(i for i,l in enumerate(ls) if l.startswith('Vietnamese')); rows=[re.match(r'^(.+?)\s+[-–—]\s+([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,4})?)$',l) for l in ls[s:e+1]]; print(len([r for r in rows if r]))"
      ```
      `howCounted` 에 행 수·중복 0·파싱실패 0 과 "요약 질의는 110·86·176 으로 갈렸다"를 적는다.
      `expansion` 은 기존 8종만 `legacy-estimate`, 나머지는 스크립트 그룹 대표값 `group-estimate`.
    - [x] `lib/cli-input.mjs` 를 **이 플러그인의 것으로** 쓴다. 다른 플러그인에서 import 하지 않는다.
          `runCli` 는 사유만 stderr 로 내고 1 로 끝난다. 성공 경로에서 `process.exit(0)` 을 부르지 않는다.
    - [x] `git mv plugins/nereus-game/lib/locales.mjs plugins/nereus-l10n/lib/locales.mjs` 하고
          `git mv plugins/nereus-game/locales.json plugins/nereus-l10n/locales.json` 한다.
          **세 export(`loadLocales`·`localeIds`·`expansionOf`)의 반환 형태를 바꾸지 않는다.** 확장은 새 키로만 한다.
    - [x] 마켓플레이스에 `nereus-l10n` 항목을 더한다(`source: ./plugins/nereus-l10n`, version 일치).
    - [x] 통과 확인: Run `npx vitest run tests/lib/locales.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-l10n .claude-plugin/marketplace.json tests/lib/locales.test.ts && git commit -m "feat(l10n): 플러그인 뼈대 + 로케일 모듈 이관 + Play 86종"`
  - Done when: `claude plugin validate plugins/nereus-l10n` 이 통과하고 기존 4케이스가 단언 그대로 초록이며 새 5케이스가 통과한다

- [x] T2. 소스 l10n 검사기 이관 — 기존 테스트를 들고 간다
  - Files: Create `plugins/nereus-l10n/lib/l10n-scan.mjs` · Modify `tests/lib/l10n-scan.test.ts` · Delete `plugins/nereus-game/lib/l10n-scan.mjs`
  - Interfaces: Produces `scanL10n({ tables, sources, maxWidth, fonts, accessor, exclude }): { violations, skipped }`
  - Steps:
    - [x] **기존 테스트를 새 경로로 돌린다. 케이스를 다시 쓰지 않는다** — 기존 23케이스(`l10n-scan.test.ts`)가 이관의 안전망이다.
          새로 쓰면 커버리지가 조용히 줄고, 줄어든 것이 초록으로 보인다:
      ```bash
      sed -i '' 's|plugins/nereus-game/lib/l10n-scan.mjs|plugins/nereus-l10n/lib/l10n-scan.mjs|' tests/lib/l10n-scan.test.ts
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: FAIL (모듈 없음)
    - [x] `git mv plugins/nereus-game/lib/l10n-scan.mjs plugins/nereus-l10n/lib/l10n-scan.mjs` 한다.
          로케일은 T1 이 옮긴 `./locales.mjs` 에서 읽는다. **반환 형태를 바꾸지 않는다.**
    - [x] 통과 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: PASS (23케이스 그대로)
    - [x] 커밋: `git add plugins tests && git commit -m "refactor(l10n): 소스 l10n 검사기와 로케일 모듈 이관"`
  - Done when: 기존 23케이스가 **케이스 수 그대로** 초록이고 `plugins/nereus-game/lib/l10n-scan.mjs` 가 없다

- [x] T3. 폰트 검사기 이관과 requiredEmbedding 일반화
  - Files: Create `plugins/nereus-l10n/lib/font-check.mjs` · Modify `tests/lib/font-check.test.ts` · Delete `plugins/nereus-game/lib/font-check.mjs`
  - Interfaces: Produces `checkFonts({ fonts, targetLocales, userGeneratedText, requiredEmbedding, budget }): { violations }`
  - Steps:
    - [x] **기존 13케이스를 새 경로로 돌린다.** 임베딩 관련 케이스는 `requiredEmbedding: "game"` 을
          넘기도록 인자만 더한다 — **단언을 바꾸지 않는다.** 단언을 바꾸면 이관이 아니라 동작 변경이다:
      ```bash
      sed -i '' 's|plugins/nereus-game/lib/font-check.mjs|plugins/nereus-l10n/lib/font-check.mjs|; s|plugins/nereus-game/lib/cli-input.mjs|plugins/nereus-l10n/lib/cli-input.mjs|' tests/lib/font-check.test.ts
      ```
    - [x] 같은 파일에 새 동작 3케이스를 덧붙인다:
      ```ts
      const base = { name: "GameSans", embedding: ["game"], scripts: ["latin", "hangul"], sizeKb: 100, minSizePx: 18, subset: false };
      it("요구 임베딩을 주고 충족하면 통과한다", () => {
        const r = checkFonts({ fonts: [base], targetLocales: ["en"], requiredEmbedding: "game" });
        expect(r.violations.map((v: any) => v.code)).not.toContain("license-embedding");
      });
      it("요구 임베딩을 주고 불충족하면 잡는다", () => {
        const r = checkFonts({ fonts: [{ ...base, embedding: ["web"] }], targetLocales: ["en"], requiredEmbedding: "game" });
        expect(r.violations.map((v: any) => v.code)).toContain("license-embedding");
      });
      it("요구 임베딩 미선언은 통과가 아니다 — 모름은 허용이 아니다", () => {
        const r = checkFonts({ fonts: [base], targetLocales: ["en"] });
        expect(r.violations.map((v: any) => v.code)).toContain("required-embedding-undeclared");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/font-check.test.ts` · Expected: FAIL
    - [x] `git mv` 로 옮기고 `embedding.includes("game")` 하드코딩을 `requiredEmbedding` 입력으로 바꾼다.
          장르 예산은 `budget` 입력으로 받는다 — `loadProfile` 을 부르지 않는다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/font-check.test.ts` · Expected: PASS (13+3 케이스)
    - [x] 커밋: `git add plugins tests && git commit -m "refactor(l10n): 폰트 검사기 이관 + requiredEmbedding 일반화"`
  - Done when: 기존 13케이스가 단언 그대로 초록이고 새 3케이스가 통과하며 `plugins/nereus-game/lib/font-check.mjs` 가 없다

- [x] T4. 스토어 등재 게이트 — 커버리지와 선언 대조
  - Files: Create `plugins/nereus-l10n/lib/store-l10n-check.mjs` · Create `tests/lib/store-l10n-check.test.ts`
  - Interfaces: Produces `checkStoreL10n({ store, declaredLocales, listings, doNotTranslate, excluded }): { violations, coverage, skipped }`
  - Steps:
    - [x] 실패 테스트를 `tests/lib/store-l10n-check.test.ts` 에 쓴다:
      ```ts
      import { checkStoreL10n } from "../../plugins/nereus-l10n/lib/store-l10n-check.mjs";
      const listing = (title: string, short = "s") => ({ title, shortDescription: short });
      it("선언했는데 필드가 비면 잡는다 — Play 가 조용히 fallback 한다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US", "ko-KR"],
          listings: { "en-US": listing("A"), "ko-KR": listing("") } });
        expect(r.violations.map((v: any) => v.code)).toContain("declared-but-empty");
      });
      it("요구 집합 미달은 위반이 아니라 coverage 다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("A") },
          doNotTranslate: [{ field: "title", why: "검색 키워드" }, { field: "shortDescription", why: "테스트" }] });
        expect(r.violations).toEqual([]);
        expect(r.coverage.required).toBe(86);
        expect(r.coverage.present).toBe(1);
        expect(r.coverage.missing.length).toBe(85);
      });
      it("제외는 이유와 셈을 같이 낸다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("A") },
          excluded: [{ locale: "my-MM", why: "번역자 없음" }],
          doNotTranslate: [{ field: "title", why: "x" }, { field: "shortDescription", why: "y" }] });
        expect(r.skipped.find((s: any) => s.reason === "excluded").count).toBe(1);
        expect(r.coverage.missing).not.toContain("my-MM");
      });
      it("스토어 형식이 아닌 코드를 잡는다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["ko"], listings: { ko: listing("A") } });
        expect(r.violations.map((v: any) => v.code)).toContain("locale-code-unknown");
      });
      it("필드 길이 제한을 넘으면 잡는다 — 잘린 채 발행된다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("x".repeat(31)) } });
        const v = r.violations.find((x: any) => x.code === "field-length-overflow");
        expect(v.field).toBe("title");
        expect(v.limit).toBe(30);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/store-l10n-check.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 구현한다. 필드 길이 제한과 로케일 코드 형식은 `locales.json` 의 `stores.play` 에서 읽는다 —
          코드에 박지 않는다. 제한이 선언되지 않은 스토어는 통과로 내지 않고 미검사로 보고한다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/store-l10n-check.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-l10n/lib tests/lib/store-l10n-check.test.ts && git commit -m "feat(l10n): 스토어 등재 커버리지와 선언 대조 게이트"`
  - Done when: 다섯 시나리오가 통과한다

- [x] T5. 번역 제외 선언·두부 증거·RTL 런
  - Files: Modify `plugins/nereus-l10n/lib/store-l10n-check.mjs` · Modify `tests/lib/store-l10n-check.test.ts`
  - Interfaces: Consumes `doNotTranslate: [{ field, why }]` · `render: { [locale]: { glyphCheck, titleRuns } }`
  - Steps:
    - [x] 실패 테스트를 덧붙인다:
      ```ts
      const two = { "en-US": listing("Same", "a"), "ko-KR": listing("Same", "b") };
      it("전 로케일 동일 문자열인데 선언이 없으면 잡는다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US", "ko-KR"], listings: two });
        const v = r.violations.find((x: any) => x.code === "untranslated-undeclared");
        expect(v.field).toBe("title");
      });
      it("이유와 함께 선언되어 있으면 통과한다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US", "ko-KR"], listings: two,
          doNotTranslate: [{ field: "title", why: "앱 이름이 검색 키워드다" }] });
        expect(r.violations.map((x: any) => x.code)).not.toContain("untranslated-undeclared");
      });
      it("이유 없는 선언을 잡는다 — 이유 없는 경계가 가장 먼저 지워진다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US", "ko-KR"], listings: two,
          doNotTranslate: [{ field: "title" }] });
        expect(r.violations.map((x: any) => x.code)).toContain("declaration-without-why");
      });
      it("글리프 검증 증거가 없으면 통과시키지 않는다 — 렌더러는 두부를 그리고 exit 0 한다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["ko-KR"], listings: { "ko-KR": listing("A") },
          render: { "ko-KR": {} }, doNotTranslate: [{ field: "title", why: "x" }, { field: "shortDescription", why: "y" }] });
        expect(r.violations.map((x: any) => x.code)).toContain("tofu-unverified");
      });
      it("증거에 빠진 글리프가 있으면 잡는다", () => {
        const r = checkStoreL10n({ store: "play", declaredLocales: ["ko-KR"], listings: { "ko-KR": listing("A") },
          render: { "ko-KR": { glyphCheck: { ranAt: "2026-09-13", tool: "fonttools", missing: [{ face: "Oswald", chars: "가나" }] } } },
          doNotTranslate: [{ field: "title", why: "x" }, { field: "shortDescription", why: "y" }] });
        expect(r.violations.map((x: any) => x.code)).toContain("glyph-missing");
      });
      it("RTL 타이틀을 쪼개 그리면 잡는다", () => {
        const ok = { glyphCheck: { ranAt: "2026-09-13", tool: "t", missing: [] } };
        const r = checkStoreL10n({ store: "play", declaredLocales: ["ar"], listings: { ar: listing("A") },
          render: { ar: { ...ok, titleRuns: 2 } }, doNotTranslate: [{ field: "title", why: "x" }, { field: "shortDescription", why: "y" }] });
        expect(r.violations.map((x: any) => x.code)).toContain("rtl-split-run");
      });
      it("LTR 은 쪼개도 된다", () => {
        const ok = { glyphCheck: { ranAt: "2026-09-13", tool: "t", missing: [] } };
        const r = checkStoreL10n({ store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("A") },
          render: { "en-US": { ...ok, titleRuns: 2 } }, doNotTranslate: [{ field: "title", why: "x" }, { field: "shortDescription", why: "y" }] });
        expect(r.violations.map((x: any) => x.code)).not.toContain("rtl-split-run");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/store-l10n-check.test.ts` · Expected: FAIL
    - [x] 구현한다. RTL 판정은 `locales.json` 의 `direction` 으로만 한다 — 코드에 목록을 박지 않는다.
          `render` 를 주지 않은 로케일은 렌더 대상이 아니므로 두부 검사를 하지 않는다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/store-l10n-check.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-l10n/lib tests/lib/store-l10n-check.test.ts && git commit -m "feat(l10n): 번역 제외 선언·두부 증거·RTL 런 게이트"`
  - Done when: 일곱 시나리오가 통과한다

- [x] T6. ASO 조언자
  - Files: Create `plugins/nereus-l10n/lib/aso-advisor.mjs` · Create `tests/lib/aso-advisor.test.ts`
  - Interfaces: Produces `adviseAso({ coverage, signals }): { levers, unanswerable }`
  - Steps:
    - [x] 실패 테스트를 `tests/lib/aso-advisor.test.ts` 에 쓴다:
      ```ts
      import { adviseAso } from "../../plugins/nereus-l10n/lib/aso-advisor.mjs";
      const coverage = { required: 86, present: 2, missing: ["pt-BR", "fr-FR"], skipped: [] };
      it("게이트가 아니다 — violations 를 내지 않는다", () => {
        expect(adviseAso({ coverage })).not.toHaveProperty("violations");
      });
      it("점유 신호가 없으면 순위를 매기지 않는다", () => {
        const r = adviseAso({ coverage });
        expect(r.levers).toEqual([]);
        expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/점유/);
      });
      it("점유 신호를 주면 빠진 로케일을 신호 순으로 낸다", () => {
        const r = adviseAso({ coverage, signals: { share: { "pt-BR": 0.13, "fr-FR": 0.05 } } });
        expect(r.levers[0].locale).toBe("pt-BR");
        expect(r.levers.map((l: any) => l.locale)).not.toContain("en-US");
      });
      it("번역 품질은 판정하지 않았다고 항상 적는다", () => {
        const r = adviseAso({ coverage, signals: { share: { "pt-BR": 0.13 } } });
        expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/품질/);
      });
      it("답할 수 없는 질문 자체에 무엇이 없는지 적는다", () => {
        const r = adviseAso({ coverage });
        expect(r.unanswerable.every((u: any) => u.question.length > 0 && u.needs.length > 0)).toBe(true);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/aso-advisor.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 구현한다. **실측 점유율을 파일에 넣지 않는다** — `signals` 로만 받는다.
          진입점을 붙인다: `pathToFileURL` 비교, 성공 경로에서 `process.exit(0)` 금지.
    - [x] 통과 확인: Run `npx vitest run tests/lib/aso-advisor.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-l10n/lib tests/lib/aso-advisor.test.ts && git commit -m "feat(l10n): ASO 로케일 우선순위 조언자"`
  - Done when: 다섯 시나리오가 통과한다

- [ ] T7. 스킬 3종과 에이전트와 README
  - Files: Create `plugins/nereus-l10n/skills/l10n/SKILL.md` · Create `plugins/nereus-l10n/skills/storelisting/SKILL.md` · Create `plugins/nereus-l10n/skills/typeface/SKILL.md` · Create `plugins/nereus-l10n/agents/l10n-engineer.md` · Create `plugins/nereus-l10n/README.md`
  - Interfaces: 없음
  - Steps:
    - [ ] `skills/l10n/SKILL.md` — 소스 문자열 검사. `l10n-scan.mjs` 호출법, 제외 규칙,
          ToonTone 461:0 사건("끄게 만드는 게이트는 게이트가 아니다")을 그대로 적는다.
    - [ ] `skills/storelisting/SKILL.md` — 등재 텍스트. `store-l10n-check.mjs` 호출법.
          **"번역하지 않기로 한 것은 이유와 함께 선언한다"를 원칙으로 적는다.**
          앱 이름이 검색 키워드라는 도너 판정을 적되 **실측 점유율은 적지 않는다**.
    - [ ] `skills/typeface/SKILL.md` — 스크립트 커버리지·두부·RTL. `font-check.mjs` 호출법.
          "렌더러는 빠진 글리프를 두부로 그리고 exit 0 한다"를 적는다.
          하네스가 폰트를 파싱하지 않고 **증거를 요구**하는 이유를 적는다.
    - [ ] `agents/l10n-engineer.md` — 이름이 다른 세 플러그인과 겹치지 않게 한다.
          TDD 절차는 `nereus:build` 것을 쓴다고 적는다.
    - [ ] README 에 세 스킬·두 검사기·이관 내역과 "게임 고유 2건은 `nereus-game` 이 데이터로 주입한다"를 적는다.
    - [ ] 커밋: `git add plugins/nereus-l10n && git commit -m "docs(l10n): 스킬 3종·에이전트·README"`
  - Done when: 세 SKILL.md 와 에이전트가 존재하고 각각 자기 검사기를 가리킨다

- [ ] T8. 라우트 배선·companion·가드·프로세스 리그
  - Files: Create `plugins/nereus-l10n/nereus-extension.json` · Modify `plugins/nereus-game/nereus-extension.json` · Create `tests/smoke/l10n-wiring.test.ts` · Create `tests/smoke/l10n-rig.test.ts` · Modify `tests/smoke/no-unwired-exports.test.ts` · Modify `tests/smoke/ads-wiring.test.ts`
  - Interfaces: Produces 라우트 3개 · `companions` 1건
  - Steps:
    - [ ] 실패 테스트 `tests/smoke/l10n-wiring.test.ts` 를 쓴다:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import path from "node:path";
      const ROOT = "plugins/nereus-l10n";
      it("마켓플레이스 등재와 매니페스트 이름·버전이 같다", () => {
        const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
        const e = mp.plugins.find((p: any) => p.name === "nereus-l10n");
        const pj = JSON.parse(fs.readFileSync(`${ROOT}/.claude-plugin/plugin.json`, "utf8"));
        expect(e.version).toBe(pj.version);
      });
      it("모든 스킬이 라우트를 갖는다", () => {
        const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
        const routed = new Set(ext.routes.map((r: any) => r.skill.split(":")[1]));
        for (const s of fs.readdirSync(`${ROOT}/skills`)) expect(routed.has(s), s).toBe(true);
      });
      it("라우트가 `번역`·`언어` 단독 단어로 잡지 않는다", () => {
        const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
        for (const r of ext.routes) for (const w of ["번역", "언어"]) {
          expect(new RegExp(r.re, "i").test(w), `${r.skill} 이 ${w} 를 잡는다`).toBe(false);
        }
      });
      it("네 플러그인의 스킬 이름이 겹치지 않는다", () => {
        const names = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d) : []);
        const all = ["nereus", "nereus-game", "nereus-ads", "nereus-l10n"].flatMap((p) => names(`plugins/${p}/skills`));
        expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
      });
      it("네 플러그인의 에이전트 이름이 겹치지 않는다", () => {
        const names = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).map((f) => f.replace(/\.md$/, "")) : []);
        const all = ["nereus", "nereus-game", "nereus-ads", "nereus-l10n"].flatMap((p) => names(`plugins/${p}/agents`));
        expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
      });
      it("nereus-game 이 nereus-l10n 을 동반으로 선언한다", () => {
        const ext = JSON.parse(fs.readFileSync("plugins/nereus-game/nereus-extension.json", "utf8"));
        const c = (ext.companions ?? []).find((x: any) => x.id === "nereus-l10n");
        expect(c, "companions 에 nereus-l10n 이 없다").toBeTruthy();
        expect(c.why).toBeTruthy();
      });
      it("nereus-game 이 nereus-l10n 의 검사기를 부르지 않는다", () => {
        const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
          .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
        for (const f of walk("plugins/nereus-game")) {
          if (!/\.(mjs|md)$/.test(f)) continue;
          expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/nereus-l10n\/lib/);
        }
      });
      it("다른 플러그인을 import 하지 않는다", () => {
        const SPEC = /(?:^|\s)(?:import\s[^;]*?from\s*|import\s*\(\s*|require\s*\(\s*)["'`]([^"'`]+)["'`]/g;
        const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
          .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
        for (const f of walk(ROOT).filter((x) => x.endsWith(".mjs"))) {
          for (const m of fs.readFileSync(f, "utf8").matchAll(SPEC)) {
            expect(m[1], `${f}`).not.toMatch(/nereus-game|nereus-ads|nereus\/hooks|hooks\/scripts\/lib|\.\.\/\.\.\//);
          }
        }
      });
      ```
    - [ ] 실패 테스트 `tests/smoke/l10n-rig.test.ts` 를 쓴다:
      ```ts
      import { describe, it, expect } from "vitest";
      import { execFileSync } from "node:child_process";
      const run = (s: string, input: string) =>
        execFileSync("node", [s], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
      const STORE = "plugins/nereus-l10n/lib/store-l10n-check.mjs";
      const ASO = "plugins/nereus-l10n/lib/aso-advisor.mjs";
      it("스토어 게이트를 프로세스로 돌린다", () => {
        const out = run(STORE, JSON.stringify({ store: "play", declaredLocales: ["ko"], listings: { ko: { title: "A" } } }));
        expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("locale-code-unknown");
      });
      it("조언자를 프로세스로 돌린다", () => {
        const out = run(ASO, JSON.stringify({ coverage: { required: 86, present: 1, missing: ["pt-BR"], skipped: [] }, signals: { share: { "pt-BR": 0.13 } } }));
        expect(JSON.parse(out).levers[0].locale).toBe("pt-BR");
      });
      it("입력이 없어도 유효한 JSON 을 낸다 — 0바이트가 아니다", () => {
        for (const s of [STORE, ASO]) {
          const out = run(s, "");
          expect(out.trim().length, s).toBeGreaterThan(0);
          expect(() => JSON.parse(out), s).not.toThrow();
        }
      });
      it("깨진 JSON 은 스택 프레임 없이 사유만 낸다", () => {
        for (const s of [STORE, ASO]) {
          let failed = false;
          try { run(s, "{nope"); } catch (e: any) {
            failed = true;
            expect(e.status, s).not.toBe(0);
            expect(String(e.stderr), s).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
          }
          expect(failed, s).toBe(true);
        }
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/smoke/l10n-wiring.test.ts tests/smoke/l10n-rig.test.ts` · Expected: FAIL
    - [ ] `plugins/nereus-l10n/nereus-extension.json` 에 라우트 3개를 쓴다. 각 라우트에 `why` 를 적는다.
          `l10n`: `현지화|l10n|로케일|locale|다국어|하드코딩\s?문자열|arb\s?파일`
          `storelisting`: `스토어\s?등재|등재\s?텍스트|앱\s?제목|스토어\s?설명|패치\s?노트|릴리스\s?노트|스크린샷\s?문구|\baso\b`
          `typeface`: `폰트\s?(커버리지|라이선스|예산)|두부|tofu|글리프|glyph|스크립트\s?커버리지|\brtl\b|서브셋`
    - [ ] `plugins/nereus-game/nereus-extension.json` 의 `companions` 에 `nereus-l10n` 을 이유와 함께 더한다.
    - [ ] `store-l10n-check.mjs` 와 `aso-advisor.mjs` 에 프로세스 진입점을 붙인다.
          `pathToFileURL` 로 비교하고 성공 경로에서 `process.exit(0)` 을 부르지 않는다.
    - [ ] `tests/smoke/no-unwired-exports.test.ts` 의 `ROOTS` 에 `plugins/nereus-l10n/lib` 를,
          `SEARCH` 에 `plugins/nereus-l10n` 을 더한다.
    - [ ] `tests/smoke/ads-wiring.test.ts` 의 이름 충돌 검사 플러그인 목록에 `nereus-l10n` 을 더한다.
    - [ ] 통과 확인: Run `npx vitest run tests/smoke/` · Expected: PASS
    - [ ] 역검증: 라우트 하나를 지우고 FAIL 하는지, `companions` 항목을 지우고 FAIL 하는지,
          진입점 하나를 지우고 FAIL 하는지 각각 확인하고 되돌린다. **새 파일은 `git checkout` 이 먹지 않는다** — 사본을 떠 둔다.
    - [ ] 커밋: `git add plugins tests && git commit -m "feat(l10n): 라우트 배선·companion·프로세스 리그"`
  - Done when: 가드가 실제로 물고 역검증 3건이 전부 빨개진다

- [ ] T9. 게임 플러그인 정리와 설치·doctor·전체 테스트
  - Files: Modify `plugins/nereus-game/skills/localization/SKILL.md` · Modify `plugins/nereus-game/.claude-plugin/plugin.json` · Modify `.claude-plugin/marketplace.json`
  - Interfaces: 없음
  - Steps:
    - [ ] **남은 참조자 4곳을 고친다.** 이관 대상 모듈을 이름으로 가리키는 곳이다:
          `plugins/nereus-game/skills/asset/SKILL.md`(폰트 절 위임 문구) ·
          `tests/smoke/game-domain-liveops.test.ts:22,49`(스킬↔lib 대응표) ·
          `tests/smoke/liveops-rig.test.ts:45`(프로세스 리그 목록).
          Run `grep -rl "l10n-scan\|font-check\|lib/locales\.mjs" plugins tests` · Expected: `nereus-l10n` 밖 결과 없음
    - [ ] `plugins/nereus-game/skills/localization/SKILL.md` 를 게임 고유분만 남기고 줄인다:
          게임 임베딩 라이선스를 `requiredEmbedding: "game"` 으로 넘긴다는 것과 장르 폰트 예산 주입.
          나머지는 `nereus-l10n` 의 세 스킬을 가리킨다. **검사기를 프로세스로 부르는 명령을 적지 않는다.**
    - [ ] `nereus-game` 버전을 올리고 마켓플레이스 등재 버전도 같이 올린다.
          **버전을 안 올리면 설치 캐시가 낡은 채로 남는다**(2026-09-13 에 `nereus` 0.17.0 에서 겪었다).
    - [ ] Run `node plugins/nereus/skills/spec/scripts/lint-tasks.mjs openspec/changes/2026-09-13-add-l10n-harness/tasks.md` · Expected: 위반 0
    - [ ] Run `claude plugin validate plugins/nereus-l10n` · Expected: 통과
    - [ ] Run `claude plugin marketplace update nereus && claude plugin install nereus-l10n@nereus && claude plugin update nereus-game@nereus` · Expected: 설치 성공
    - [ ] 설치본과 저장소를 대조한다: Run `diff -rq ~/.claude/plugins/cache/nereus/nereus-l10n/0.1.0 plugins/nereus-l10n` · Expected: 차이 0
          (설치 경로에 **버전이 한 겹 더 있다**)
    - [ ] Run `node plugins/nereus/skills/doctor/scripts/doctor.mjs` · Expected: HIGH 충돌 0
    - [ ] Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [ ] 커밋. **문서를 테스트 뒤에 쓰지 않는다** — evidence 가 STALE 이 된다
  - Done when: doctor 가 HIGH 0 이고 전체 테스트가 초록이며 설치본 차이가 0 이다

## Global Constraints

- 스택: Node ESM(`.mjs`), 테스트는 vitest. **새 런타임 의존성을 추가하지 않는다** — 폰트 파일을 파싱하지 않는다.
- **`nereus-l10n` 은 다른 플러그인이나 코어 내부 모듈을 import 하지 않는다.** `cli-input.mjs` 도 자기 것을 갖는다.
- **`nereus-game` 은 `nereus-l10n` 의 검사기를 호출하지 않는다.** `companions` 로만 건다.
- 검사기는 stdin JSON → stdout JSON. 성공 경로에서 `process.exit(0)` 을 부르지 않는다(파이프가 64KiB 에서 잘린다).
- 경로는 `pathToFileURL`/`fileURLToPath` 를 거친다. 메인 개발 환경이 Windows 다.
- 로케일·스토어 데이터는 **출처 URL·확인일·셈의 방법**과 함께 둔다. 코드에 박지 않는다.
- **실측 수치(로케일별 매출·설치 점유율)를 하네스에 복사하지 않는다.** `signals` 로 받는다.
- 게이트(`violations`)와 조언자(`levers`)를 한 파일에 섞지 않는다.
- 미달은 위반이 아니라 `coverage` 다. 제외는 `skipped` 로 셈과 이유를 같이 낸다.
- **미설정을 허용·통과로 읽지 않는다** — 대상 로케일 미선언은 전체 요구, 요구 임베딩 미선언은 위반,
  두부 증거 미제출은 위반이다.
- 경계·분류 선언에 `why` 를 빼지 않는다.
- `~/workspace/claude-skills/wallpaper-deploy` 와 WallpaperEngineApp 은 **읽기 전용**이다.
- 꺾쇠로 감싼 플레이스홀더를 이 파일에 쓰지 않는다. lint-tasks 가 잡는다.
