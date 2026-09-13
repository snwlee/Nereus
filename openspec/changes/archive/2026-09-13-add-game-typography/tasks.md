# tasks — add-game-typography

- [x] T1. 폰트 검사기를 만든다
  - Files: Create `plugins/nereus-game/lib/font-check.mjs` · Test `tests/lib/font-check.test.ts`
  - Interfaces: Produces `checkFonts({ profile, fonts, locales, targetLocales, userGeneratedText }): { violations: Array, unmeasured: string[] }`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/font-check.test.ts` — 스펙 `font.check` 의 7개 시나리오를 옮긴다.
      임베딩 미허용, 임베딩 선언 없음, 로케일 스크립트 미커버, 유저 생성 텍스트 + 서브셋,
      용량 초과, 최소 크기 미만, 프로파일 기준 없음.
    - [x] 실패 확인: Run `npx vitest run tests/lib/font-check.test.ts` · Expected: FAIL (font-check.mjs 없음)
    - [x] `plugins/nereus-game/lib/font-check.mjs` 작성. 판정 규칙:
      - `license-embedding`: 폰트의 `embedding` 배열이 `"game"` 을 포함하지 않거나 선언이 없음
      - `script-uncovered`: 대상 로케일의 `script` 를 어떤 폰트의 `scripts` 도 포함하지 않음
      - `subset-unsafe`: `userGeneratedText` 가 참인데 폰트의 `subset` 이 참
      - `font-size-budget`: 폰트 `sizeKb` 합이 `profile.typography.maxFontKb` 초과
      - `min-size`: 폰트의 `minSizePx` 가 `profile.typography.minSizePx` 미만
      - `profile.typography` 가 없으면 예산·크기 항목을 건너뛰고 `unmeasured` 에 `"typography-baseline"`
        을 넣는다. 라이선스·스크립트·서브셋은 프로파일과 무관하므로 그대로 판정한다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/font-check.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/font-check.mjs tests/lib/font-check.test.ts && git commit -m "feat(game): 폰트 검사기 — 라이선스·글리프·서브셋·용량·크기"`
  - Done when: 7개 시나리오가 통과하고, 프로파일 기준이 없어도 라이선스·스크립트 판정은 계속 돈다

- [x] T2. 로케일에 폰트 축을 넣고 l10n 폭 판정을 실체화한다
  - Files: Modify `plugins/nereus-game/locales.json` · Modify `plugins/nereus-game/lib/l10n-scan.mjs` · Test `tests/lib/l10n-scan.test.ts`
  - Interfaces: Consumes `expansionOf(data, id): number` · Produces `scanL10n` 의 `fonts` 선택 인자와 위반의 `approx` 키
  - Steps:
    - [x] 실패 테스트를 `tests/lib/l10n-scan.test.ts` 에 덧붙인다:
      ```ts
      it("폰트 메트릭 없이 낸 폭 판정은 근사임을 표시한다", () => {
        const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
        const v = scanL10n({ locales, tables, maxWidth: 9 }).violations.find((x: any) => x.code === "overflow");
        expect(v.approx).toBe(true);
      });
      it("폰트 메트릭이 있으면 그것으로 폭을 재고 근사가 아니다", () => {
        const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
        const fonts = { de: { avgCharWidth: 2 } };
        const v = scanL10n({ locales, tables, maxWidth: 9, fonts }).violations.find((x: any) => x.code === "overflow" && x.locale === "de");
        expect(v.approx).toBe(false);
        expect(v.width).toBe(16);
      });
      it("모든 로케일이 script 와 avgCharWidth 를 갖는다", () => {
        for (const id of Object.keys(locales.locales)) {
          expect(locales.locales[id].script, id).toBeTruthy();
          expect(locales.locales[id].avgCharWidth, id).toBeGreaterThan(0);
        }
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: FAIL (approx 키와 script 키 없음)
    - [x] `locales.json` 의 각 로케일에 `script` 와 `avgCharWidth` 를 추가한다.
      `en`·`pt-BR`·`es`·`fr`·`de` 는 `"latin"`, `ko` 는 `"hangul"`, `ja` 는 `"kana-kanji"`, `zh` 는 `"han"`.
      `avgCharWidth` 는 1em 기준 평균 자폭 비율이다 — 라틴은 `0.5`, 한글·일본어·중국어는 `1.0`
      (전각이라 글자당 폭이 라틴의 두 배다). 이 값이 확장률과 다른 축이라는 점을 `note` 로 남긴다.
    - [x] `l10n-scan.mjs` 의 폭 판정을 고친다. `fonts[localeId].avgCharWidth` 가 있으면
      `문자 수 × avgCharWidth` 로 폭을 계산하고 `approx: false`, 없으면 기존 `문자 수 × 확장률` 로
      계산하고 `approx: true` 를 붙인다. **기존 위반 코드 집합은 바꾸지 않는다.**
    - [x] 통과 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/locales.json plugins/nereus-game/lib/l10n-scan.mjs tests/lib/l10n-scan.test.ts && git commit -m "fix(game): 폭 판정에 폰트 메트릭을 쓰고 근사 여부를 표시한다"`
  - Done when: 8개 로케일이 `script`·`avgCharWidth` 를 갖고, 폰트 메트릭 유무로 `approx` 가 갈리며 기존 테스트가 전부 통과한다

- [x] T3. 프로파일 기준·스킬 문서·실행 진입점을 배선한다
  - Files: Modify `plugins/nereus-game/profiles/sim-tycoon.json` · Modify `plugins/nereus-game/skills/localization/SKILL.md` · Modify `plugins/nereus-game/lib/font-check.mjs`
  - Interfaces: Consumes `checkFonts` (T1) · `loadProfile(genre, deps): Profile` · Produces 실행 진입점 `node lib/font-check.mjs`
  - Steps:
    - [x] 실패 테스트를 `tests/lib/profiles-domains.test.ts` 와 `tests/smoke/game-domain-liveops.test.ts` 에 덧붙인다:
      ```ts
      it("모든 장르가 typography 기준을 갖는다", () => {
        for (const g of listProfiles()) expect(loadProfile(g).typography, g).toBeTruthy();
      });
      ```
      그리고 배선 검사에:
      ```ts
      it("localization 스킬이 폰트 검사기를 부른다", () => {
        const md = fs.readFileSync("plugins/nereus-game/skills/localization/SKILL.md", "utf8");
        expect(md).toContain("font-check.mjs");
      });
      it("asset 스킬이 폰트 라이선스를 경유 규칙으로 갖는다", () => {
        const md = fs.readFileSync("plugins/nereus-game/skills/asset/SKILL.md", "utf8");
        expect(md).toMatch(/폰트/);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/profiles-domains.test.ts tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL
    - [x] 네 프로파일에 `typography` 를 추가한다. 오비는 화면 위에 글자가 겹쳐 최소 크기가 크고,
      내러티브는 대사량이 많아 폰트 예산이 크다:
      `sim-tycoon.json`: `"typography": { "maxFontKb": 1200, "minSizePx": 14 }`
      `obby-platformer.json`: `"typography": { "maxFontKb": 900, "minSizePx": 18 }`
      `battle-pvp.json`: `"typography": { "maxFontKb": 1200, "minSizePx": 16 }`
      `narrative.json`: `"typography": { "maxFontKb": 2000, "minSizePx": 15 }`
    - [x] `skills/localization/SKILL.md` 에 "## 폰트" 절을 넣는다. 네 축(라이선스·글리프·서브셋·폭),
      `node "${CLAUDE_PLUGIN_ROOT}/lib/font-check.mjs"` 사용법, 위반 코드 표,
      그리고 **유저 생성 텍스트가 있으면 서브셋을 금지하는 이유**(닉네임이 두부가 된다)를 적는다.
      기존 `maxWidth` 절에 폰트 메트릭이 없으면 근사라는 것을 명시한다.
    - [x] `skills/asset/SKILL.md` 의 오디오 절 뒤에 "## 폰트 — 라이선스가 먼저다" 절을 넣는다.
      게임 임베딩을 허용하지 않는 폰트가 흔하다는 것과, 웹폰트 라이선스로 게임에 넣으면 위반이라는 것.
    - [x] `skills/gameux/SKILL.md` 의 HUD 절에 포인터 한 줄을 넣는다:
      "글자 크기·외곽선·폰트 라이선스는 `nereus-game:localization` 의 폰트 절이 수치로 판정한다."
    - [x] `lib/font-check.mjs` 끝에 실행 진입점을 붙인다. 상단에
      `import { readFileSync } from "node:fs";` 와 `import { loadProfile } from "./profiles.mjs";`,
      `import { loadLocales } from "./locales.mjs";` 를 넣고:
      ```js
      function readStdin() {
        try { return readFileSync(0, "utf8"); } catch { return ""; }
      }

      if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
        const input = JSON.parse(readStdin() || "{}");
        const profile = loadProfile(input.genre);
        const result = checkFonts({
          profile,
          fonts: input.fonts,
          locales: loadLocales(),
          targetLocales: input.targetLocales,
          userGeneratedText: input.userGeneratedText,
        });
        process.stdout.write(JSON.stringify(result) + "\n");
        process.exit(0);
      }
      ```
    - [x] 리그 테스트를 `tests/smoke/liveops-rig.test.ts` 에 덧붙인다:
      ```ts
      it("폰트 검사기를 프로세스로 돌려 라이선스 위반을 받는다", () => {
        const fonts = [{ name: "WebOnly", embedding: ["web"], scripts: ["latin"], sizeKb: 100, minSizePx: 20 }];
        const out = runNode("plugins/nereus-game/lib/font-check.mjs", JSON.stringify({ genre: "obby-platformer", fonts, targetLocales: ["en"] }));
        expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("license-embedding");
      });
      ```
    - [x] 통과 확인: Run `npx vitest run tests/lib/profiles-domains.test.ts tests/smoke/game-domain-liveops.test.ts tests/smoke/liveops-rig.test.ts` · Expected: PASS
    - [x] 역검증: `skills/localization/SKILL.md` 에서 `font-check.mjs` 문자열을 임시로 지우고
      Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL. 확인 후 되돌린다.
    - [x] 전체 확인: Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game tests && git commit -m "feat(game): 폰트 기준·문서·실행 진입점을 배선한다"`
  - Done when: 네 장르가 `typography` 를 갖고, 세 스킬 문서가 폰트를 다루며, 검사기가 자식 프로세스로 돌아 `license-embedding` 을 내고, 문서 배선을 떼면 테스트가 실패하는 것을 역검증으로 확인했다

## Global Constraints

- 스택: Node.js ESM (`.mjs`), 테스트는 vitest + TypeScript.
- **코어 `plugins/nereus` 를 수정하지 않는다.**
- `scanL10n` 의 기존 위반 코드 집합과 반환 형태를 바꾸지 않는다. 새 키·선택 인자로만 확장한다.
- 기존 `overflow` 판정을 제거하지 않는다 — 폰트 메트릭이 없을 때의 유일한 신호다.
- 모든 새 `export` 는 자기 파일 밖에서 참조되거나 실행 진입점에서 쓰여야 한다.
- 프로파일 키는 선택 키로 추가한다. `validateProfile` 의 필수 키를 늘리지 않는다.
- 문서를 테스트보다 먼저 쓴다. 테스트를 마지막에 돌려야 evidence 가 FRESH 로 남는다.
