# tasks — add-ads-harness

WallpaperEngineApp 은 읽기만 한다. 그 저장소에 다른 세션 2개가 붙어 있다.

- [ ] T1. 플러그인 뼈대와 정책 데이터
  - Files: Create `plugins/nereus-ads/.claude-plugin/plugin.json` · Create `plugins/nereus-ads/ads-policy.json` · Create `plugins/nereus-ads/lib/cli-input.mjs` · Modify `.claude-plugin/marketplace.json` · Create `tests/lib/ad-policy-check.test.ts`
  - Interfaces: Produces `ads-policy.json` 의 `demoUnits[platform][format]` · `formats` 목록
  - Steps:
    - [ ] 실패 테스트를 `tests/lib/ad-policy-check.test.ts` 에 쓴다:
      ```ts
      import { loadAdsPolicy } from "../../plugins/nereus-ads/lib/ad-policy-check.mjs";
      it("포맷 7종과 두 플랫폼의 데모 단위가 데이터로 있다", () => {
        const p = loadAdsPolicy();
        expect(p.formats.length).toBeGreaterThanOrEqual(7);
        for (const os of ["android", "ios"]) for (const f of p.formats) {
          expect(p.demoUnits[os][f], `${os}/${f}`).toMatch(/^ca-app-pub-3940256099942544\//);
        }
      });
      it("정책 수치에 출처와 확인일이 붙어 있다", () => {
        const p = loadAdsPolicy();
        expect(p.source).toMatch(/^https:\/\//);
        expect(p.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: FAIL (모듈 없음)
    - [ ] `plugin.json` 을 쓴다: name `nereus-ads`, version `0.1.0`, license `MIT`.
    - [ ] `ads-policy.json` 을 쓴다. 데모 단위는 WallpaperEngineApp `ad_unit_id_policy.dart` 에서 뜬다.
          `source` 는 구글 공식 테스트 광고 문서 URL, `checkedAt` 은 오늘 날짜.
    - [ ] `lib/cli-input.mjs` 를 이 플러그인의 것으로 쓴다. **다른 플러그인에서 import 하지 않는다.**
          `runCli` 는 사유만 stderr 로 내고 1 로 끝난다. 성공 경로에서 `process.exit(0)` 을 부르지 않는다.
    - [ ] 마켓플레이스에 `nereus-ads` 항목을 더한다(`source: ./plugins/nereus-ads`, version 일치).
    - [ ] 통과 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-ads .claude-plugin/marketplace.json tests/lib/ad-policy-check.test.ts && git commit -m "feat(ads): 플러그인 뼈대와 정책 데이터"`
  - Done when: `claude plugin validate plugins/nereus-ads` 가 통과하고 위 두 테스트가 초록이다

- [ ] T2. 무효 트래픽 방어 — 데모/프로덕션 단위 판정
  - Files: Create `plugins/nereus-ads/lib/ad-policy-check.mjs` · Modify `tests/lib/ad-policy-check.test.ts`
  - Interfaces: Produces `checkAdPolicy({ policy, build, units, session, consent, targeting }): { violations }`
  - Steps:
    - [ ] 실패 테스트를 덧붙인다:
      ```ts
      const unit = (id: string) => ({ format: "interstitial", platform: "android", resolvedId: id });
      it("디버그에서 프로덕션 단위를 쓰면 잡는다", () => {
        const r = checkAdPolicy({ build: { debug: true }, units: [unit("ca-app-pub-9999/1")] });
        expect(r.violations.map(v => v.code)).toContain("prod-unit-in-debug");
      });
      it("디버그에서 데모 단위는 통과한다", () => {
        const r = checkAdPolicy({ build: { debug: true }, units: [unit("ca-app-pub-3940256099942544/1033173712")] });
        expect(r.violations).toEqual([]);
      });
      it("릴리스에 데모 단위가 남으면 잡는다 — 수익이 0 이 되고 조용하다", () => {
        const r = checkAdPolicy({ build: { debug: false }, units: [unit("ca-app-pub-3940256099942544/1033173712")] });
        expect(r.violations.map(v => v.code)).toContain("demo-unit-in-release");
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: FAIL
    - [ ] `checkAdPolicy` 를 쓴다. 데모 단위 판정은 `ads-policy.json` 의 표로만 한다 — 코드에 ID 를 박지 않는다.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-ads/lib tests/lib/ad-policy-check.test.ts && git commit -m "feat(ads): 무효 트래픽 방어 — 디버그/릴리스 광고 단위 판정"`
  - Done when: 네 시나리오(디버그 프로덕션·디버그 데모·릴리스 정상·릴리스 데모)가 통과한다

- [ ] T3. 첫 세션 보호와 동의 순서
  - Files: Modify `plugins/nereus-ads/lib/ad-policy-check.mjs` · Modify `tests/lib/ad-policy-check.test.ts`
  - Interfaces: Consumes `session: { launchCount, protectionEnabled }` · `consent: { initBeforeConsent, skippedForConsent, retryRegistered }`
  - Steps:
    - [ ] 실패 테스트를 덧붙인다:
      ```ts
      it("카운터가 없으면 첫 세션으로 본다 — 보호 해제로 읽지 않는다", () => {
        const r = checkAdPolicy({ session: { launchCount: 0 }, plan: { formats: ["interstitial"] } });
        expect(r.violations.map(v => v.code)).toContain("first-session-interruptive");
      });
      it("보호 구간의 리워드는 막지 않는다 — 사용자가 스스로 고른 것이다", () => {
        const r = checkAdPolicy({ session: { launchCount: 0 }, plan: { formats: ["rewarded"] } });
        expect(r.violations.map(v => v.code)).not.toContain("first-session-interruptive");
      });
      it("킬 스위치로 끄면 보호가 적용되지 않는다", () => {
        const r = checkAdPolicy({ session: { launchCount: 0, protectionEnabled: false }, plan: { formats: ["interstitial"] } });
        expect(r.violations.map(v => v.code)).not.toContain("first-session-interruptive");
      });
      it("동의 전 초기화를 잡는다", () => {
        const r = checkAdPolicy({ consent: { initBeforeConsent: true } });
        expect(r.violations.map(v => v.code)).toContain("init-before-consent");
      });
      it("동의로 건너뛴 포맷에 재시도가 없으면 잡는다", () => {
        const r = checkAdPolicy({ consent: { skippedForConsent: ["banner"], retryRegistered: [] } });
        expect(r.violations.map(v => v.code)).toContain("consent-retry-missing");
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: FAIL
    - [ ] 구현한다. 중단형 포맷 목록은 `ads-policy.json` 의 데이터다.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-ads/lib tests/lib/ad-policy-check.test.ts && git commit -m "feat(ads): 첫 세션 보호와 동의 순서 게이트"`
  - Done when: 다섯 시나리오가 통과한다

- [ ] T4. 타게팅 신호 일관성
  - Files: Modify `plugins/nereus-ads/lib/ad-policy-check.mjs` · Modify `tests/lib/ad-policy-check.test.ts`
  - Interfaces: Consumes `targeting: { [format]: { keywords: string[], contentUrl: string|null } }`
  - Steps:
    - [ ] 실패 테스트를 덧붙인다:
      ```ts
      const t = { keywords: ["wallpaper", "kpop"], contentUrl: "https://example.com" };
      it("포맷마다 신호가 다르면 잡는다", () => {
        const r = checkAdPolicy({ targeting: { banner: t, rewarded: { keywords: ["kpop"], contentUrl: null } } });
        expect(r.violations.map(v => v.code)).toContain("targeting-mismatch");
      });
      it("빈 요청을 잡는다 — 도너에서 매치율이 깎였다", () => {
        const r = checkAdPolicy({ targeting: { banner: { keywords: [], contentUrl: null }, rewarded: t } });
        expect(r.violations.map(v => v.code)).toContain("targeting-empty");
      });
      it("전부 같으면 통과한다", () => {
        const r = checkAdPolicy({ targeting: { banner: t, rewarded: t } });
        expect(r.violations).toEqual([]);
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: FAIL
    - [ ] 구현한다. 개인화 설정은 판정 대상이 아니다 — UMP 와 SDK 가 정한다.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/ad-policy-check.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-ads/lib tests/lib/ad-policy-check.test.ts && git commit -m "feat(ads): 타게팅 신호 일관성 검사"`
  - Done when: 세 시나리오가 통과한다

- [ ] T5. 퍼널 조언자 — 병목·믹스 역전·답할 수 없는 것
  - Files: Create `plugins/nereus-ads/lib/ad-funnel.mjs` · Create `tests/lib/ad-funnel.test.ts`
  - Interfaces: Produces `analyzeFunnel({ formats, targets }): { rates, bottleneck, levers, unanswerable }`
  - Steps:
    - [ ] 실패 테스트를 쓴다:
      ```ts
      import { analyzeFunnel } from "../../plugins/nereus-ads/lib/ad-funnel.mjs";
      const rewarded = { format: "rewarded", requests: 163000, matched: 150881, impressions: 25803, revenue: 170 };
      it("채움은 멀쩡한데 지면이 문제인 경우를 show 병목으로 지목한다", () => {
        const r = analyzeFunnel({ formats: [rewarded], targets: { showRate: 0.3, matchRate: 0.8 } });
        expect(r.bottleneck.rewarded).toBe("show");
      });
      it("두 비율을 따로 낸다 — 하나로 뭉치면 결론이 뒤집힌다", () => {
        const r = analyzeFunnel({ formats: [rewarded], targets: { showRate: 0.3, matchRate: 0.8 } });
        expect(r.rates.rewarded.matchRate).toBeGreaterThan(0.9);
        expect(r.rates.rewarded.showRate).toBeLessThan(0.2);
      });
      it("기준이 없으면 병목을 단정하지 않는다", () => {
        const r = analyzeFunnel({ formats: [rewarded] });
        expect(r.bottleneck).toEqual({});
        expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/기준/);
      });
      it("요청이 0 이면 비율이 null 이다 — 나눗셈을 하지 않는다", () => {
        const r = analyzeFunnel({ formats: [{ format: "banner", requests: 0, matched: 0, impressions: 0, revenue: 0 }] });
        expect(r.rates.banner.matchRate).toBeNull();
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/ad-funnel.test.ts` · Expected: FAIL
    - [ ] 구현한다. 게이트가 아니므로 `violations` 를 내지 않는다.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/ad-funnel.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-ads/lib tests/lib/ad-funnel.test.ts && git commit -m "feat(ads): 퍼널 병목 조언자"`
  - Done when: 네 시나리오가 통과한다

- [ ] T6. 믹스 역전과 답할 수 없는 질문
  - Files: Modify `plugins/nereus-ads/lib/ad-funnel.mjs` · Modify `tests/lib/ad-funnel.test.ts`
  - Interfaces: Produces `levers: [{ format, code, advice }]` · `unanswerable: [{ question, needs }]`
  - Steps:
    - [ ] 실패 테스트를 덧붙인다:
      ```ts
      const mix = [
        { format: "banner", requests: 1000, matched: 400, impressions: 780, revenue: 24 },
        { format: "rewarded", requests: 1000, matched: 900, impressions: 220, revenue: 76 },
      ];
      it("노출 점유가 수익 점유보다 크면 역전으로 표시한다", () => {
        const r = analyzeFunnel({ formats: mix });
        const codes = r.levers.filter((l: any) => l.format === "banner").map((l: any) => l.code);
        expect(codes).toContain("mix-inversion");
      });
      it("처방이 노출을 줄이라고 말하지 않는다 — 줄이라는 처방은 꺼진다", () => {
        const r = analyzeFunnel({ formats: mix });
        const lever = r.levers.find((l: any) => l.code === "mix-inversion");
        expect(lever.advice).not.toMatch(/줄이|제거|없애/);
      });
      it("CTR 이 임계를 넘으면 정책 리포트가 필요하다고 낸다", () => {
        const r = analyzeFunnel({ formats: [{ format: "interstitial", requests: 100, matched: 100, impressions: 100, clicks: 20, revenue: 1 }], targets: { maxCtr: 0.1 } });
        expect(r.unanswerable.map((u: any) => u.needs).join(" ")).toMatch(/정책 리포트/);
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/ad-funnel.test.ts` · Expected: FAIL
    - [ ] 구현한다. 역전 판정은 점유율 비교이지 절대값 비교가 아니다.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/ad-funnel.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-ads/lib tests/lib/ad-funnel.test.ts && git commit -m "feat(ads): 믹스 역전과 답할 수 없는 질문"`
  - Done when: 세 시나리오가 통과한다

- [ ] T7. 스킬 3종과 에이전트
  - Files: Create `plugins/nereus-ads/skills/adpolicy/SKILL.md` · Create `plugins/nereus-ads/skills/adplacement/SKILL.md` · Create `plugins/nereus-ads/skills/adrevenue/SKILL.md` · Create `plugins/nereus-ads/agents/ads-engineer.md` · Create `plugins/nereus-ads/README.md`
  - Interfaces: 없음
  - Steps:
    - [ ] `adpolicy` — 무효 트래픽·첫 세션·동의. `ad-policy-check.mjs` 호출법을 적는다.
          "정책 안전 처방은 노출을 줄이지 않는다"를 원칙으로 적는다.
    - [ ] `adplacement` — 포맷별 배치. 전면 광고는 손가락이 멈춘 뒤에 띄우되
          **노출은 줄이지 않는다**(언제만 늦추고 최대 대기 후 통과). 쿨다운·세션 상한·이탈 지면.
    - [ ] `adrevenue` — 레버 순서: show rate → 믹스 역전 → 고RPM 편중 → 집중도 → 트래픽 방어.
          `ad-funnel.mjs` 호출법과 "답할 수 없는 것"을 적는다. **실측 수치는 적지 않는다.**
    - [ ] `agents/ads-engineer.md` — 이름이 다른 두 플러그인과 겹치지 않게 한다.
          TDD 절차는 `nereus:build` 것을 쓴다고 적는다.
    - [ ] README 에 세 축과 두 검사기, 그리고 원격 설정 키 분류는 `nereus-game:liveops` 가 한다고 적는다.
    - [ ] 통과 확인: Run `npx vitest run tests/smoke/ads-wiring.test.ts` · Expected: FAIL (아직 T8 미작성이면 건너뛴다)
    - [ ] 커밋: `git add plugins/nereus-ads && git commit -m "docs(ads): 스킬 3종·에이전트·README"`
  - Done when: 세 SKILL.md 와 에이전트가 존재하고 각각 자기 검사기를 가리킨다

- [ ] T8. 배선 가드와 프로세스 리그
  - Files: Create `plugins/nereus-ads/nereus-extension.json` · Create `tests/smoke/ads-wiring.test.ts` · Create `tests/smoke/ads-rig.test.ts`
  - Interfaces: Produces 라우트 3개
  - Steps:
    - [ ] 실패 테스트 `tests/smoke/ads-wiring.test.ts` 를 쓴다:
      ```ts
      it("마켓플레이스 등재와 매니페스트 이름·버전이 같다", () => {
        const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
        const e = mp.plugins.find((p: any) => p.name === "nereus-ads");
        const pj = JSON.parse(fs.readFileSync("plugins/nereus-ads/.claude-plugin/plugin.json", "utf8"));
        expect(e.version).toBe(pj.version);
      });
      it("라우트가 가리키는 스킬이 전부 있다", () => {
        const ext = JSON.parse(fs.readFileSync("plugins/nereus-ads/nereus-extension.json", "utf8"));
        for (const r of ext.routes) {
          expect(fs.existsSync(`plugins/nereus-ads/skills/${r.skill.split(":")[1]}/SKILL.md`), r.skill).toBe(true);
        }
      });
      it("세 플러그인의 스킬·에이전트 이름이 겹치지 않는다", () => {
        const names = (dir: string) => fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        const all = ["nereus", "nereus-game", "nereus-ads"].flatMap((p) => [
          ...names(`plugins/${p}/skills`),
          ...names(`plugins/${p}/agents`).map((f) => f.replace(/\.md$/, "")),
        ]);
        expect(all.length - new Set(all).size, `중복: ${all.filter((n, i) => all.indexOf(n) !== i).join(", ")}`).toBe(0);
      });
      it("다른 플러그인을 import 하지 않는다 — 설치 조합에 따라 조용히 깨진다", () => {
        const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
          .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
        for (const f of walk("plugins/nereus-ads").filter((x) => x.endsWith(".mjs"))) {
          expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/nereus-game|hooks\/scripts\/lib/);
        }
      });
      ```
    - [ ] 실패 테스트 `tests/smoke/ads-rig.test.ts` 를 쓴다:
      ```ts
      const run = (s: string, input: string) => execFileSync("node", [s], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      const POLICY = "plugins/nereus-ads/lib/ad-policy-check.mjs";
      const FUNNEL = "plugins/nereus-ads/lib/ad-funnel.mjs";
      it("정책 검사기를 프로세스로 돌린다", () => {
        const out = run(POLICY, JSON.stringify({ build: { debug: true }, units: [{ format: "interstitial", platform: "android", resolvedId: "ca-app-pub-9999/1" }] }));
        expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("prod-unit-in-debug");
      });
      it("퍼널 조언자를 프로세스로 돌린다", () => {
        const out = run(FUNNEL, JSON.stringify({ formats: [{ format: "rewarded", requests: 100, matched: 92, impressions: 17, revenue: 5 }], targets: { showRate: 0.3, matchRate: 0.8 } }));
        expect(JSON.parse(out).bottleneck.rewarded).toBe("show");
      });
      it("깨진 JSON 은 스택 프레임 없이 사유만 낸다", () => {
        for (const s of [POLICY, FUNNEL]) {
          try { run(s, "{nope"); throw new Error("종료되지 않았다"); }
          catch (e: any) {
            expect(e.status, s).not.toBe(0);
            expect(String(e.stderr), s).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
          }
        }
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/smoke/ads-wiring.test.ts tests/smoke/ads-rig.test.ts` · Expected: FAIL
    - [ ] `nereus-extension.json` 에 라우트 3개를 쓴다. **좁게** 쓴다 — `광고` 단독 단어를 쓰지 않는다
          (`nereus-game:compliance` 와 경쟁한다). 포맷 이름·AdMob 어휘·지표 이름으로 잡는다.
    - [ ] 두 lib 에 프로세스 진입점을 붙인다. `pathToFileURL` 로 비교한다. `process.exit(0)` 금지.
    - [ ] 통과 확인: Run `npx vitest run tests/smoke/ads-wiring.test.ts tests/smoke/ads-rig.test.ts` · Expected: PASS
    - [ ] 역검증: 라우트 하나를 지우면 FAIL 하는지 확인하고 되돌린다
    - [ ] 커밋: `git add plugins/nereus-ads tests/smoke && git commit -m "feat(ads): 라우트 배선과 프로세스 리그"`
  - Done when: 가드가 실제로 물고 역검증이 통과한다

- [ ] T9. 설치·충돌 점검 · 전체 테스트 · 마무리
  - Files: none
  - Interfaces: 없음
  - Steps:
    - [ ] Run `claude plugin validate plugins/nereus-ads` · Expected: 통과
    - [ ] Run `claude plugin marketplace update nereus && claude plugin install nereus-ads@nereus` · Expected: 설치 성공
    - [ ] Run `node plugins/nereus/skills/doctor/scripts/doctor.mjs` · Expected: HIGH 충돌 0
    - [ ] Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [ ] 커밋. **문서를 테스트 뒤에 쓰지 않는다** — evidence 가 STALE 이 된다
  - Done when: doctor 가 HIGH 0 이고 전체 테스트가 초록이며 evidence FRESH 다

## Global Constraints

- 스택: Node ESM(`.mjs`), 테스트는 vitest. 새 런타임 의존성을 추가하지 않는다.
- **`nereus-ads` 는 다른 플러그인이나 코어 내부 모듈을 import 하지 않는다.** `cli-input.mjs` 도 자기 것을 갖는다.
- 검사기는 stdin JSON → stdout JSON. 성공 경로에서 `process.exit(0)` 을 부르지 않는다(파이프가 64KiB 에서 잘린다).
- 경로는 `pathToFileURL`/`fileURLToPath` 를 거친다. 메인 개발 환경이 Windows 다.
- 정책 수치는 `ads-policy.json` 에 **출처 URL·확인일과 함께** 둔다. 코드에 박지 않는다.
- **실측 수익 수치(eCPM·RPM·show rate 실제값)와 퍼블리셔 ID 를 하네스에 복사하지 않는다.**
- 게이트(`violations`)와 조언자(`levers`)를 한 파일에 섞지 않는다.
- 답할 수 없는 것은 `unanswerable` 로 낸다. 조용히 빠뜨리지 않는다.
- WallpaperEngineApp 은 **읽기 전용**이다. 다른 세션 2개가 붙어 있다.
