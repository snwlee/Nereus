# tasks — add-montage-styles

테스트는 저장소 루트에서 `npx vitest run <패턴>`. 스크립트 루트 `plugins/nereus/skills/montage/scripts`.

- [x] T1. 스타일 카탈로그 — 정규화·고르기 [wave:1]
  - Files: Create `plugins/nereus/skills/montage/scripts/style-catalog.mjs` · Test `tests/skills/montage-styles-catalog.test.ts`
  - Interfaces: Consumes 없음 · Produces `normalizeStyle(json): Style|null`, `tokens(text): string[]`, `pickStyles(catalog: Style[], brief: string, opts?: {commercial?: boolean, n?: number}): Pick[]`, `BLOCKED_STYLES` (Style = `{slug,name,category,uses,film,line,dur}`, Pick = Style + `{score, matched, warning?}`)
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { normalizeStyle, tokens, pickStyles, BLOCKED_STYLES } from "../../plugins/nereus/skills/montage/scripts/style-catalog.mjs";

      const artDeco = { slug: "art-deco", num: "18", en: "Art Deco", cn: "装饰艺术", category_en: "Graphic & Type", category_cn: "图形与排版",
        film: "Midnight at the Starlight Hotel", line: "A grand hotel, 1930: a bellboy races lifts and revolving doors to deliver one letter before midnight.",
        uses: ["Luxury & hospitality", "Galas", "Invitations"], frame_sec: 17.52, dur: 58.4 };
      const ascii = { slug: "ascii-crt", en: "ASCII / CRT Terminal", category_en: "Graphic & Type", film: "Tranquility.log",
        line: "A moon-base AI wakes after forty years to a signal from Earth.", uses: ["Developer tools", "Sci-fi", "Tech brands"], dur: 59.8 };
      const screencast = { slug: "living-screencast", en: "Living Screencast", category_en: "Screen & UI", film: "Clawd ships",
        line: "A desktop comes alive as the agent works.", uses: ["Developer tools", "Product demos"], dur: 50 };
      const cat = [ascii, artDeco, screencast].map((s) => normalizeStyle(s)!);

      describe("montage-styles.catalog", () => {
        it("정규화", () => {
          expect(normalizeStyle(artDeco)).toEqual({ slug: "art-deco", name: "Art Deco", category: "Graphic & Type",
            uses: ["Luxury & hospitality", "Galas", "Invitations"], film: "Midnight at the Starlight Hotel", line: artDeco.line, dur: 58.4 });
        });
        it("템플릿·잘못된 slug 제외, uses 없으면 빈 배열", () => {
          expect(normalizeStyle({ slug: "_template", en: "x" })).toBeNull();
          expect(normalizeStyle({ slug: "../x", en: "x" })).toBeNull();
          expect(normalizeStyle({ slug: "plain", en: "Plain" })!.uses).toEqual([]);
        });
        it("토큰 — 소문자·구두점 분리·복수 s 제거·한글 유지", () => {
          expect(tokens("Luxury & Galas, Invitations! 고급 호텔 a")).toEqual(["luxury", "gala", "invitation", "고급", "호텔"]);
        });
      });

      describe("montage-styles.pick", () => {
        it("용도 매칭", () => {
          const r = pickStyles(cat, "luxury hotel gala invitation");
          expect(r[0].slug).toBe("art-deco");
          expect(r[0].matched).toEqual(["gala", "hotel", "invitation", "luxury"]);
          expect(r[0].score).toBe(4);
        });
        it("점수 0 은 빼고 n 개까지", () => {
          expect(pickStyles(cat, "zzzz qqqq")).toEqual([]);
          expect(pickStyles(cat, "developer tools", { n: 1 })).toHaveLength(1);
        });
        it("동점은 slug 사전순, 결정적", () => {
          const a = pickStyles(cat, "developer tools").map((x) => x.slug);
          expect(a).toEqual(["ascii-crt", "living-screencast"]);
          expect(pickStyles(cat, "developer tools").map((x) => x.slug)).toEqual(a);
        });
        it("광고면 차단 스타일 제외, 비상업이면 경고", () => {
          expect(BLOCKED_STYLES["living-screencast"]).toMatch(/Clawd/);
          expect(pickStyles(cat, "developer tools", { commercial: true }).map((x) => x.slug)).toEqual(["ascii-crt"]);
          const nc = pickStyles(cat, "developer tools", { commercial: false });
          expect(nc.find((x) => x.slug === "living-screencast")!.warning).toMatch(/Clawd/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/montage-styles-catalog.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: `tokens` = 소문자 → `/[^a-z0-9가-힣]+/` 분리 → 길이 2 이상 → 4자 이상이면 끝 `s` 제거 → 순서 유지 중복 제거. `normalizeStyle` 은 slug 정규식 `^[a-z0-9][a-z0-9-]*$` 검사 후 새 객체. `pickStyles` 는 브리프 토큰 집합과 스타일 토큰 집합의 교집합을 정렬해 `matched`, 길이를 `score`, `BLOCKED_STYLES = { "living-screencast": "Clawd (Anthropic 마스코트) 등장 — 상표, 광고 금지" }`
    - [x] 통과 확인: Run `npx vitest run tests/skills/montage-styles-catalog.test.ts` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `montage-styles-catalog.test.ts` 7 케이스 PASS

- [x] T2. 동반 도구 정책 [wave:1]
  - Files: Create `plugins/nereus/skills/montage/scripts/style-companions.mjs` · Test `tests/skills/montage-styles-companions.test.ts`
  - Interfaces: Consumes 없음 · Produces `companionVerdict(name: string, opts?: {commercial?: boolean, named?: boolean, paidKey?: boolean}): {verdict: "allow"|"conditional"|"block", reason: string}`, `COMPANIONS` (이름 → `{repo, license}`)
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { companionVerdict, COMPANIONS } from "../../plugins/nereus/skills/montage/scripts/style-companions.mjs";

      describe("montage-styles.companion", () => {
        it("lemo 는 허용", () => {
          expect(companionVerdict("lemo-opuscar", { commercial: true }).verdict).toBe("allow");
          expect(companionVerdict("Lemo Opuscar").verdict).toBe("allow");
        });
        it("onetake — 광고 차단, 비상업 지명만 조건부", () => {
          const ad = companionVerdict("onetake", { commercial: true, named: true });
          expect(ad.verdict).toBe("block");
          expect(ad.reason).toMatch(/PolyForm/);
          expect(companionVerdict("onetake", { commercial: false, named: true }).verdict).toBe("conditional");
          expect(companionVerdict("onetake", { commercial: false }).verdict).toBe("block");
        });
        it("collage — 키 없으면 차단, 있으면 조건부", () => {
          expect(companionVerdict("Collage B-roll", {}).verdict).toBe("block");
          const c = companionVerdict("collage_broll", { paidKey: true, commercial: true });
          expect(c.verdict).toBe("conditional");
          expect(c.reason).toMatch(/budget/);
        });
        it("claude animation base — 광고 차단(Clawd), 비상업 조건부", () => {
          expect(companionVerdict("claude-animation-base", { commercial: true }).reason).toMatch(/Clawd/);
          expect(companionVerdict("claude-animation-base", { commercial: true }).verdict).toBe("block");
          expect(companionVerdict("Claude Animation Base", { commercial: false }).verdict).toBe("conditional");
        });
        it("미상은 차단, 저장소 기록", () => {
          expect(companionVerdict("something-else").verdict).toBe("block");
          expect(COMPANIONS["lemo-opuscar"].repo).toBe("https://github.com/lemomo-ai/lemo-opuscar");
          expect(COMPANIONS["onetake"].license).toMatch(/PolyForm/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/montage-styles-companions.test.ts` · Expected: FAIL
    - [x] 최소 구현: 이름 정규화 `trim().toLowerCase().replace(/[\s_]+/g, "-")`, 별칭 `collage-b-roll`→`collage-broll`. COMPANIONS 에 4종 repo·license(조사 보고서 값). 분기는 스펙 그대로
    - [x] 통과 확인: Run `npx vitest run tests/skills/montage-styles-companions.test.ts` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `montage-styles-companions.test.ts` 5 케이스 PASS

- [x] T3. CLI — doctor·list·pick·show·companion [flow]
  - Files: Create `plugins/nereus/skills/montage/scripts/styles.mjs` · Test `tests/skills/montage-styles-cli.test.ts`
  - Interfaces: Consumes T1·T2 · Produces CLI `node styles.mjs {doctor|list|pick|show|companion} [인자]` (stdout JSON, 0=성공 · 1=입력 오류 · 2=Lemo 없음), `lemoHome(env)` 기본 `${HOME}/.local/share/nereus/montage/lemo-opuscar`, `NEREUS_LEMO` 우선
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect, beforeAll } from "vitest";
      import { spawnSync } from "node:child_process";
      import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
      import { tmpdir } from "node:os";
      import { join } from "node:path";

      const CLI = join(process.cwd(), "plugins/nereus/skills/montage/scripts/styles.mjs");
      let lemo = "";
      const run = (args: string[], env: Record<string, string> = {}) =>
        spawnSync("node", [CLI, ...args], { encoding: "utf8", env: { ...process.env, NEREUS_HOME: lemo, NEREUS_LEMO: lemo, ...env } });

      beforeAll(() => {
        lemo = mkdtempSync(join(tmpdir(), "lemo-"));
        const style = (slug: string, json: object, md = "# x") => {
          mkdirSync(join(lemo, "styles", slug), { recursive: true });
          writeFileSync(join(lemo, "styles", slug, "style.json"), JSON.stringify({ slug, ...json }));
          writeFileSync(join(lemo, "styles", slug, "STYLE.md"), md);
        };
        style("art-deco", { en: "Art Deco", category_en: "Graphic & Type", line: "A grand hotel", uses: ["Luxury & hospitality", "Galas"] });
        style("living-screencast", { en: "Living Screencast", category_en: "Screen & UI", line: "desktop", uses: ["Developer tools"] });
        style("_template", { en: "T" });
        mkdirSync(join(lemo, "styles", "no-json"), { recursive: true });
      });

      describe("montage styles CLI [flow]", () => {
        it("list 는 템플릿·json 없는 폴더를 뺀다", () => {
          const r = run(["list"]);
          expect(r.status, r.stderr).toBe(0);
          expect(JSON.parse(r.stdout).styles.map((s: { slug: string }) => s.slug)).toEqual(["art-deco", "living-screencast"]);
        });
        it("pick — 광고면 차단 스타일 제외", () => {
          const r = run(["pick", "developer tools luxury", "--commercial"]);
          expect(r.status, r.stderr).toBe(0);
          expect(JSON.parse(r.stdout).picks.map((s: { slug: string }) => s.slug)).toEqual(["art-deco"]);
        });
        it("show 는 STYLE.md 경로와 본문", () => {
          const r = run(["show", "art-deco"]);
          const j = JSON.parse(r.stdout);
          expect(j.path).toBe(join(lemo, "styles", "art-deco", "STYLE.md"));
          expect(j.body).toBe("# x");
        });
        it("show 는 잘못된 slug 를 거부", () => {
          expect(run(["show", "../../etc"]).status).toBe(1);
          expect(run(["show", "nope"]).status).toBe(1);
        });
        it("companion 판정", () => {
          const r = run(["companion", "onetake", "--commercial", "--named"]);
          expect(r.status).toBe(0);
          expect(JSON.parse(r.stdout).verdict).toBe("block");
        });
        it("Lemo 가 없으면 2 와 설치 안내", () => {
          const r = run(["list"], { NEREUS_LEMO: join(lemo, "missing") });
          expect(r.status).toBe(2);
          expect(r.stderr).toMatch(/git clone/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/montage-styles-cli.test.ts` · Expected: FAIL (CLI 없음)
    - [x] 최소 구현: `styles/*/style.json` 을 `readdirSync` → `JSON.parse` → `normalizeStyle` (파싱 실패 폴더는 stderr 경고 후 건너뜀) → slug 정렬. `doctor` 는 Lemo 존재·`git -C` 현재 커밋·스타일 수. `show` 는 slug 정규식 검사 후 카탈로그에 있을 때만 STYLE.md 읽기. 플래그 `--commercial`·`--named`·`--paid-key`·`--n`·`--category`
    - [x] 통과 확인: Run `npx vitest run tests/skills/montage-styles-cli.test.ts` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `montage-styles-cli.test.ts` 6 케이스 PASS, 실제 clone 으로 `pick` 실행 결과 확인

- [x] T4. 라우터 — 영상 스타일 트리거
  - Files: Modify `plugins/nereus/hooks/scripts/lib/router.mjs` · Test `tests/lib/router.test.ts`
  - Interfaces: Consumes `routePrompt` · Produces montage 정규식 확장
  - Steps:
    - [x] 실패 테스트 작성 (`tests/lib/router.test.ts` 끝에 추가):
      ```ts
      describe("router: montage styles", () => {
        it("영상 스타일·룩·lemo 는 montage", () => {
          for (const p of ["이 광고 영상 스타일 골라줘", "영상 룩 좀 다르게", "lemo opuscar 스타일로", "영상스타일 추천"])
            expect(routePrompt(p).map((h) => h.skill)).toContain("nereus:montage");
        });
        it("화면 스타일은 montage 가 아니다", () => {
          expect(routePrompt("버튼 스타일 수정").map((h) => h.skill)).not.toContain("nereus:montage");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: FAIL
    - [x] 최소 구현: montage 정규식 끝 `)/i` 앞에 `|(영상|비디오)\s?(스타일|룩)|\blemo\b|opuscar` 추가
    - [x] 통과 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `router.test.ts` 전부 PASS

- [x] T5. montage SKILL.md 스타일 절
  - Files: Modify `plugins/nereus/skills/montage/SKILL.md`
  - Interfaces: Consumes T3 CLI · Produces 문서
  - Steps:
    - [x] 2절 절차 2번(파이프라인 고르기) 앞에 "스타일을 고른다" 단계 삽입: `styles.mjs pick "luxury hotel gala" --commercial` 처럼 영문 키워드로 → 후보 3~5 를 사용자에게 보이고 → 고른 STYLE.md 를 읽어 장면 지시(팔레트·타이포·모션·카메라 규칙)로 옮긴다
    - [x] 새 절 "스타일 출처와 동반 도구": Lemo clone 명령(플러그인 설치 금지 이유), 정책 표 4종(allow/conditional/block 과 이유), 영문 키워드 권장(uses 가 영문), Opus 5.5 튜닝·3D/셰이더 품질 저하 메모
    - [x] 확인: Run `npx vitest run` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `grep -c "styles.mjs" plugins/nereus/skills/montage/SKILL.md` ≥ 1 (나머지는 `$S` 로 참조), 전체 테스트 PASS

## Global Constraints
- Node 20+ 표준 라이브러리만, 외부 실행은 인자 배열. 순수 모듈은 입력을 변경하지 않는다. 파일 300줄 이하.
- 테스트는 임시 디렉터리 픽스처와 `NEREUS_HOME` 격리. 네트워크·실제 clone 에 의존하지 않는다.
- Lemo 는 플러그인 설치 금지(트리거 충돌). onetake·Collage·CAB 코드 차용 금지.
- 기존 미커밋 변경(balance-sim 등)은 건드리지 않는다.
