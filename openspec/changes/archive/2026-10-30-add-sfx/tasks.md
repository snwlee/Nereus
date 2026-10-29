# tasks — add-sfx

스킬 루트: `plugins/nereus/skills/sfx` (아래 `S`). 테스트는 저장소 루트에서 `npx vitest run <패턴>`.

- [x] T1. 라이선스 판정 [wave:1]
  - Files: Create `plugins/nereus/skills/sfx/scripts/license.mjs` · Test `tests/skills/sfx-license.test.ts`
  - Interfaces: Consumes 없음 · Produces `classifyLicense(license?: string): { verdict: "allow"|"credit"|"block", license: string }`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { classifyLicense } from "../../plugins/nereus/skills/sfx/scripts/license.mjs";

      describe("sfx.license", () => {
        it("CC0·PDM·합성음은 허용", () => {
          expect(classifyLicense("CC0")).toEqual({ verdict: "allow", license: "cc0" });
          expect(classifyLicense("pdm").verdict).toBe("allow");
          expect(classifyLicense("synth").verdict).toBe("allow");
        });
        it("CC-BY 는 표기 조건", () => {
          expect(classifyLicense("by")).toEqual({ verdict: "credit", license: "by" });
        });
        it("비상업·변경금지·동일조건·sampling+·미상은 차단", () => {
          for (const l of ["by-nc", "by-nd", "by-sa", "by-nc-sa", "by-nc-nd", "sampling+", "", undefined, "weird"])
            expect(classifyLicense(l as string).verdict).toBe("block");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-license.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: `license.mjs` 에 ALLOW=`cc0,pdm,synth`, CREDIT=`by` 집합과 `classifyLicense` 작성(소문자·trim 정규화, 그 외 block)
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-license.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/license.mjs tests/skills/sfx-license.test.ts && git commit -m "feat(sfx): license verdict"`
  - Done when: `sfx-license.test.ts` 3 케이스 PASS

- [x] T2. 장면 시각 파서 [wave:1]
  - Files: Create `plugins/nereus/skills/sfx/scripts/scenes.mjs` · Test `tests/skills/sfx-scenes.test.ts`
  - Interfaces: Consumes 없음 · Produces `parseSceneTimes(stderr: string, opts?: { minGapSec?: number }): number[]`, `sceneArgs(video: string, threshold?: number): string[]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { parseSceneTimes, sceneArgs } from "../../plugins/nereus/skills/sfx/scripts/scenes.mjs";

      const line = (t: number) => `[Parsed_showinfo_1 @ 0x1] n:   0 pts:  12 pts_time:${t}    duration:1 fmt:yuv420p`;

      describe("sfx.scenes", () => {
        it("근접 중복 제거·오름차순", () => {
          expect(parseSceneTimes([line(2.5), line(1.0), line(1.1)].join("\n"))).toEqual([1, 2.5]);
        });
        it("반올림 셋째 자리", () => {
          expect(parseSceneTimes(line(1.23456))).toEqual([1.235]);
        });
        it("minGapSec 조절", () => {
          expect(parseSceneTimes([line(1.0), line(1.1)].join("\n"), { minGapSec: 0.05 })).toEqual([1, 1.1]);
        });
        it("ffmpeg 인자", () => {
          const a = sceneArgs("in.mp4", 0.4);
          expect(a).toContain("in.mp4");
          expect(a.join(" ")).toContain("select='gt(scene,0.4)',showinfo");
          expect(a.slice(-3)).toEqual(["-f", "null", "-"]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-scenes.test.ts` · Expected: FAIL
    - [x] 최소 구현: `pts_time:([0-9.]+)` 전역 매치 → 정렬 → minGap(기본 0.25) 필터 → `Math.round(x*1000)/1000`. `sceneArgs` = `["-hide_banner","-i",video,"-vf",`select='gt(scene,${threshold??0.3})',showinfo`,"-an","-f","null","-"]`
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-scenes.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/scenes.mjs tests/skills/sfx-scenes.test.ts && git commit -m "feat(sfx): scene time parser"`
  - Done when: `sfx-scenes.test.ts` 4 케이스 PASS

- [x] T3. 합성기 어댑터 (sfxlite) [wave:1]
  - Files: Create `plugins/nereus/skills/sfx/scripts/sfxlite.mjs` · Test `tests/skills/sfx-sfxlite.test.ts`
  - Interfaces: Consumes 없음 · Produces `parseList(stdout): {id,durSec,peakSec,kinds}[]`, `buildRenderArgs({id,out,dur?,apex?,pitch?,seed?}): string[]`, `parseRenderLine(stdout): {durSec,peakSec,checks}|null`, `SFXLITE_COMMIT`, `sfxliteHome(env?): string`, `sfxlitePython(home): string`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { parseList, buildRenderArgs, parseRenderLine, SFXLITE_COMMIT, sfxliteHome } from "../../plugins/nereus/skills/sfx/scripts/sfxlite.mjs";

      const LIST = [
        "252 sounds in the bank forge_v2r6+forge04r1+fit1+pluck1",
        "id                              dur s peak s  kinds / knobs",
        "click/soft                      0.094  0.004  click | dur param, pitch F#7 -33c",
        "cut_hit/air                     0.549  0.043  hit | dur trim, pitch Ab1 -32c",
        "fit/key/thock                   0.120  0.003  key, click | dur param",
      ].join("\n");
      const WROTE = "wrote p.wav: ui_pop/soft seed 1: 0.180 s, onset 0.003 s, peak at 0.042 s, end 0.157 s, -1.0 dBFS, -15.4 LUFS momentary max; checks: clean";

      describe("sfx.synth", () => {
        it("list 파싱", () => {
          const l = parseList(LIST);
          expect(l).toHaveLength(3);
          expect(l[0]).toEqual({ id: "click/soft", durSec: 0.094, peakSec: 0.004, kinds: ["click"] });
          expect(l[2].kinds).toEqual(["key", "click"]);
        });
        it("render 인자 — 준 노브만", () => {
          expect(buildRenderArgs({ id: "ui_pop/soft", out: "a.wav" })).toEqual(["-m", "sfxlite", "render", "ui_pop/soft", "-o", "a.wav"]);
          expect(buildRenderArgs({ id: "whoosh_fast/crisp", out: "w.wav", dur: 0.8, apex: 0.32, pitch: "E6", seed: 7 }))
            .toEqual(["-m", "sfxlite", "render", "whoosh_fast/crisp", "-o", "w.wav", "--dur", "0.8", "--apex", "0.32", "--pitch", "E6", "--seed", "7"]);
        });
        it("잘못된 id 거부", () => {
          expect(() => buildRenderArgs({ id: "../x; rm", out: "a.wav" })).toThrow();
          expect(() => buildRenderArgs({ id: "click", out: "a.wav" })).toThrow();
        });
        it("render 결과 파싱", () => {
          expect(parseRenderLine(WROTE)).toEqual({ durSec: 0.18, peakSec: 0.042, checks: "clean" });
          expect(parseRenderLine("Traceback (most recent call last):")).toBeNull();
        });
        it("커밋 고정·설치 위치", () => {
          expect(SFXLITE_COMMIT).toBe("c91a7c9d2690ae658f790859d4ad4004857903dd");
          expect(sfxliteHome({ NEREUS_SFXLITE: "/x/y" })).toBe("/x/y");
          expect(sfxliteHome({ HOME: "/h" })).toBe("/h/.local/share/nereus/sfx/earshot-sfx-lite");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-sfxlite.test.ts` · Expected: FAIL
    - [x] 최소 구현: 행 정규식 `^(\S+)\s+([0-9.]+)\s+([0-9.]+)\s+([^|]+)\|` 로 list 파싱(kinds 는 `,` 분할 trim), id 정규식 `^[a-z0-9_]+(\/[a-z0-9_]+)+$`, wrote 줄에서 `: ([0-9.]+) s, onset`·`peak at ([0-9.]+) s`·`checks: (\S+)` 추출. `sfxlitePython(home)` = `${home}/.venv/bin/python` 이 있으면 그것, 없으면 `python3`
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-sfxlite.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/sfxlite.mjs tests/skills/sfx-sfxlite.test.ts && git commit -m "feat(sfx): sfxlite adapter"`
  - Done when: `sfx-sfxlite.test.ts` 5 케이스 PASS

- [x] T4. Openverse 검색 [wave:2]
  - Files: Create `plugins/nereus/skills/sfx/scripts/openverse.mjs` · Test `tests/skills/sfx-openverse.test.ts`
  - Interfaces: Consumes `classifyLicense` (T1) · Produces `buildSearchUrl({q,pageSize?}): string`, `parseResults(json): Hit[]`, `search(q, {fetchImpl?, pageSize?}): Promise 로 Hit 배열` (Hit = `{id,title,url,license,attribution,durationSec,source,filetype}`)
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { buildSearchUrl, parseResults, search } from "../../plugins/nereus/skills/sfx/scripts/openverse.mjs";

      const cc0 = { id: "a", title: "Deep Whoosh #1", url: "https://cdn.freesound.org/x.mp3", license: "cc0", license_version: "1.0",
        attribution: "\"Deep Whoosh #1\" by Kinoton is marked with CC0 1.0.", duration: 3155, source: "freesound", filetype: "mp3" };
      const nc = { ...cc0, id: "b", license: "by-nc" };

      describe("sfx.openverse", () => {
        it("category 를 싣지 않는다", () => {
          const u = new URL(buildSearchUrl({ q: "whoosh" }));
          expect(u.origin + u.pathname).toBe("https://api.openverse.org/v1/audio/");
          expect(u.searchParams.get("q")).toBe("whoosh");
          expect(u.searchParams.get("license")).toBe("cc0,pdm");
          expect(u.searchParams.get("page_size")).toBe("10");
          expect(u.searchParams.has("category")).toBe(false);
        });
        it("page_size 상한", () => {
          expect(new URL(buildSearchUrl({ q: "pop", pageSize: 50 })).searchParams.get("page_size")).toBe("20");
        });
        it("정규화와 차단 항목 제거", () => {
          const r = parseResults({ results: [nc, cc0, { ...cc0, id: "c", url: null }] });
          expect(r).toHaveLength(1);
          expect(r[0]).toEqual({ id: "a", title: "Deep Whoosh #1", url: cc0.url, license: "cc0", attribution: cc0.attribution, durationSec: 3.155, source: "freesound", filetype: "mp3" });
        });
        it("search 는 fetch 실패를 에러로 낸다", async () => {
          const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
          await expect(search("x", { fetchImpl })).rejects.toThrow(/429/);
        });
        it("search 는 정규화 결과를 돌려준다", async () => {
          const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ results: [cc0] }) });
          expect((await search("x", { fetchImpl }))[0].id).toBe("a");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-openverse.test.ts` · Expected: FAIL
    - [x] 최소 구현: `URL` + `searchParams.set` 으로 URL 작성(pageSize 를 1~20 로 clamp), `parseResults` 는 `classifyLicense(r.license).verdict !== "block" && r.url` 필터 후 정규화, `search` 는 `fetchImpl ?? fetch` 로 GET, `!ok` 면 `openverse ${status}` throw
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-openverse.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/openverse.mjs tests/skills/sfx-openverse.test.ts && git commit -m "feat(sfx): openverse search"`
  - Done when: `sfx-openverse.test.ts` 5 케이스 PASS

- [x] T5. 큐 검증·정점 정렬 [wave:2]
  - Files: Create `plugins/nereus/skills/sfx/scripts/cues.mjs` · Test `tests/skills/sfx-cues.test.ts`
  - Interfaces: Consumes 없음 · Produces `parseCues(json): { cues: Cue[], errors: {index:number, reason:string}[] }`, `delayMs(t:number, peakSec:number): number` (Cue = `{t, id?|file?|url?, gainDb, license?, attribution?, source?, apex?}`)
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { parseCues, delayMs } from "../../plugins/nereus/skills/sfx/scripts/cues.mjs";

      describe("sfx.cues", () => {
        it("정렬과 오류", () => {
          const r = parseCues([{ t: 2, id: "click/soft" }, { t: -1, id: "pop/a" }, { t: 0.5, file: "a.wav" }, { t: 1 }, { t: 3, url: "http://x" }]);
          expect(r.cues.map((c) => c.t)).toEqual([0.5, 2]);
          expect(r.errors.map((e) => e.index)).toEqual([1, 3, 4]);
        });
        it("소스는 정확히 하나", () => {
          expect(parseCues([{ t: 1, id: "a/b", file: "x.wav" }]).errors).toHaveLength(1);
        });
        it("gainDb 기본 0, -40~+6 로 자름, 메타 보존", () => {
          const r = parseCues([{ t: 1, id: "a/b", gainDb: 20 }, { t: 2, url: "https://x/y.mp3", gainDb: -99, license: "cc0", attribution: "A", source: "freesound", apex: 0.1 }, { t: 3, id: "c/d" }]);
          expect(r.cues.map((c) => c.gainDb)).toEqual([6, -40, 0]);
          expect(r.cues[1]).toMatchObject({ license: "cc0", attribution: "A", source: "freesound", apex: 0.1 });
        });
        it("배열이 아니면 오류", () => {
          expect(parseCues({} as unknown as unknown[]).errors[0].reason).toMatch(/array/);
        });
        it("정점 정렬", () => {
          expect(delayMs(1.0, 0.042)).toBe(958);
          expect(delayMs(0.01, 0.13)).toBe(0);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-cues.test.ts` · Expected: FAIL
    - [x] 최소 구현: 배열 검사 → 큐마다 `t` 유한·≥0, `[id,file,url].filter(Boolean).length === 1`, url 은 `https://` 시작 검사 → 새 객체로 복사(`gainDb` clamp) → `t` 오름차순 정렬. `delayMs` 는 스펙 식 그대로
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-cues.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/cues.mjs tests/skills/sfx-cues.test.ts && git commit -m "feat(sfx): cue validation and apex alignment"`
  - Done when: `sfx-cues.test.ts` 5 케이스 PASS

- [x] T6. 믹스 인자 [wave:2]
  - Files: Create `plugins/nereus/skills/sfx/scripts/mix.mjs` · Test `tests/skills/sfx-mix.test.ts`
  - Interfaces: Consumes 없음 · Produces `buildMixArgs({video, out, tracks: {file, delayMs, gainDb}[], hasAudio}): string[]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { buildMixArgs } from "../../plugins/nereus/skills/sfx/scripts/mix.mjs";

      const fc = (a: string[]) => a[a.indexOf("-filter_complex") + 1];
      const tracks = [{ file: "a.wav", delayMs: 958, gainDb: 0 }, { file: "b.wav", delayMs: 0, gainDb: -6 }];

      describe("sfx.mix", () => {
        it("원본 오디오 포함", () => {
          const a = buildMixArgs({ video: "in.mp4", out: "out.mp4", tracks, hasAudio: true });
          expect(fc(a)).toContain("[0:a]");
          expect(fc(a)).toContain("amix=inputs=3");
          expect(fc(a)).toContain("normalize=0");
          expect(fc(a)).toContain("duration=first");
          expect(fc(a)).toContain("adelay=958:all=1");
          expect(fc(a)).toContain("volume=-6dB");
          expect(a.join(" ")).toContain("-c:v copy");
          expect(a).not.toContain("-shortest");
          expect(a.at(-1)).toBe("out.mp4");
        });
        it("무음 영상", () => {
          const a = buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks: [tracks[0]], hasAudio: false });
          expect(fc(a)).not.toContain("[0:a]");
          expect(fc(a)).toContain("amix=inputs=1");
          expect(fc(a)).toContain("duration=longest");
        });
        it("입력 순서", () => {
          const a = buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks, hasAudio: true });
          const inputs = a.flatMap((x, i) => (x === "-i" ? [a[i + 1]] : []));
          expect(inputs).toEqual(["in.mp4", "a.wav", "b.wav"]);
        });
        it("트랙이 없으면 throw", () => {
          expect(() => buildMixArgs({ video: "in.mp4", out: "o.mp4", tracks: [], hasAudio: true })).toThrow();
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-mix.test.ts` · Expected: FAIL
    - [x] 최소 구현: 입력 `-i video` 후 트랙마다 `-i file`, 트랙 i 필터 `[${i+1}:a]adelay=${ms}:all=1,volume=${db}dB[s${i}]`, 원본 있으면 `[0:a]` 를 amix 앞에, `amix=inputs=N:normalize=0:duration=first|longest[aout]`, `-map 0:v -map [aout] -c:v copy -c:a aac -b:a 192k -y out`
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-mix.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/mix.mjs tests/skills/sfx-mix.test.ts && git commit -m "feat(sfx): ffmpeg mix args"`
  - Done when: `sfx-mix.test.ts` 4 케이스 PASS

- [x] T7. 크레딧 파일 [wave:2]
  - Files: Create `plugins/nereus/skills/sfx/scripts/credits.mjs` · Test `tests/skills/sfx-credits.test.ts`
  - Interfaces: Consumes `classifyLicense` (T1) · Produces `renderSoundsMd(entries: {t, sound, source, license, attribution?}[]): string`, `SYNTH_NOTICE`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { renderSoundsMd, SYNTH_NOTICE } from "../../plugins/nereus/skills/sfx/scripts/credits.mjs";

      describe("sfx.credits", () => {
        it("CC-BY 표기 누락 거부", () => {
          expect(() => renderSoundsMd([{ t: 1, sound: "x", source: "openverse", license: "by", attribution: "" }])).toThrow(/attribution/);
        });
        it("차단 라이선스 거부", () => {
          expect(() => renderSoundsMd([{ t: 1, sound: "x", source: "openverse", license: "by-nc", attribution: "A" }])).toThrow();
        });
        it("합성음 고지·표", () => {
          const md = renderSoundsMd([{ t: 1, sound: "ui_pop/soft", source: "sfxlite", license: "synth" }]);
          expect(md.startsWith("# Sounds")).toBe(true);
          expect(md).toContain("| t | sound | source | license | credit |");
          expect(md).toContain("ui_pop/soft");
          expect(md).toContain(SYNTH_NOTICE);
          expect(SYNTH_NOTICE).toContain("Synthesized with earshot-sfx-lite");
        });
        it("파이프 이스케이프·합성음 없으면 고지 없음", () => {
          const md = renderSoundsMd([{ t: 2, sound: "a|b", source: "freesound", license: "cc0", attribution: "x | y" }]);
          expect(md).toContain("a\\|b");
          expect(md).toContain("x \\| y");
          expect(md).not.toContain(SYNTH_NOTICE);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-credits.test.ts` · Expected: FAIL
    - [x] 최소 구현: 항목마다 `classifyLicense` → block 이면 `blocked license: ${license}` throw, credit 이면 attribution 빈 값 throw(`attribution required`). 행은 `| t | sound | source | license | credit |`, 셀은 `String(v ?? "").replace(/\|/g, "\\|")`. synth 있으면 표 뒤에 SYNTH_NOTICE
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-credits.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/credits.mjs tests/skills/sfx-credits.test.ts && git commit -m "feat(sfx): SOUNDS.md credits"`
  - Done when: `sfx-credits.test.ts` 4 케이스 PASS

- [x] T8. CLI — doctor·scenes·list·search·build·mix [flow]
  - Files: Create `plugins/nereus/skills/sfx/scripts/sfx-cli.mjs` · Test `tests/skills/sfx-cli.test.ts`
  - Interfaces: Consumes T1~T7 전부 · Produces CLI `node sfx-cli.mjs {doctor|scenes|list|search|build|mix} [인자]` (stdout JSON 한 개), 종료코드 0=성공·1=입력/판정 오류·2=도구 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect, beforeAll } from "vitest";
      import { execFileSync, spawnSync } from "node:child_process";
      import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
      import { tmpdir, homedir } from "node:os";
      import { join } from "node:path";

      const CLI = join(process.cwd(), "plugins/nereus/skills/sfx/scripts/sfx-cli.mjs");
      const HOME = process.env.NEREUS_SFXLITE ?? join(homedir(), ".local/share/nereus/sfx/earshot-sfx-lite");
      const has = (c: string) => spawnSync(c, ["-version"]).status === 0;
      const ready = has("ffmpeg") && has("ffprobe") && existsSync(join(HOME, "sfxlite"));
      const run = (args: string[]) => spawnSync("node", [CLI, ...args], { encoding: "utf8", env: { ...process.env, NEREUS_SFXLITE: HOME } });
      const dur = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));
      const streams = (f: string) => execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f], { encoding: "utf8" });

      describe("sfx-cli 입력 오류", () => {
        it("알 수 없는 명령은 1", () => {
          expect(run(["nope"]).status).toBe(1);
        });
        it("build 는 차단 라이선스 큐를 거부한다", () => {
          const d = mkdtempSync(join(tmpdir(), "sfx-"));
          writeFileSync(join(d, "cues.json"), JSON.stringify([{ t: 1, file: join(d, "x.wav"), license: "by-nc", attribution: "A" }]));
          const r = run(["build", join(d, "cues.json"), "--dir", join(d, "out")]);
          expect(r.status).toBe(1);
          expect(r.stdout + r.stderr).toMatch(/blocked/);
        });
      });

      describe.skipIf(!ready)("sfx-cli 실제 믹스 [flow]", () => {
        let d = "";
        beforeAll(() => {
          d = mkdtempSync(join(tmpdir(), "sfx-"));
          execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=320x240:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", join(d, "in.mp4")]);
        });
        it("doctor 는 0", () => {
          const r = run(["doctor"]);
          expect(r.status).toBe(0);
          expect(JSON.parse(r.stdout).ok).toBe(true);
        });
        it("build → mix", () => {
          writeFileSync(join(d, "cues.json"), JSON.stringify([{ t: 1.0, id: "ui_pop/soft" }]));
          const b = run(["build", join(d, "cues.json"), "--dir", join(d, "sfx")]);
          expect(b.status, b.stderr).toBe(0);
          const plan = JSON.parse(readFileSync(join(d, "sfx", "sfx-plan.json"), "utf8"));
          expect(plan.tracks[0].delayMs).toBeGreaterThan(900);
          expect(readFileSync(join(d, "sfx", "SOUNDS.md"), "utf8")).toMatch(/ui_pop\/soft[\s\S]*synth/);
          const m = run(["mix", join(d, "in.mp4"), "--plan", join(d, "sfx", "sfx-plan.json"), "--out", join(d, "out.mp4")]);
          expect(m.status, m.stderr).toBe(0);
          expect(Math.abs(dur(join(d, "out.mp4")) - dur(join(d, "in.mp4")))).toBeLessThan(0.1);
          expect(streams(join(d, "out.mp4"))).toContain("audio");
        }, 60000);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/sfx-cli.test.ts` · Expected: FAIL (CLI 없음)
    - [x] 최소 구현: `sfx-cli.mjs` — 인자 파서(`--dir`·`--plan`·`--out`·`--kind`·`--threshold`·`--n`), `doctor`(ffmpeg/ffprobe/`sfxliteHome()/sfxlite` 확인, 없으면 설치 명령을 담아 종료 2), `scenes`(`sceneArgs` 실행 → `parseSceneTimes`), `list`(`sfxlitePython` 으로 `-m sfxlite list [--kind]` → `parseList`), `search`(`search(q)`), `build`(parseCues → 오류 있으면 1 · 큐마다 id=`render` 로 `${NN}-${id 의 / 를 __ 로}.wav` 생성 후 `parseRenderLine` 의 peakSec, file=그대로·`apex` 를 peak 로, url=fetch 로 내려받기 → `classifyLicense` block 이면 `blocked license` 로 1 → `sfx-plan.json`{tracks:[{file,delayMs,gainDb}]} + `SOUNDS.md` 기록), `mix`(ffprobe 로 audio 스트림 유무 → `buildMixArgs` 실행 → 길이 비교 JSON). 모든 외부 실행은 `execFileSync`/`spawnSync` 인자 배열(셸 없음)
    - [x] 통과 확인: Run `npx vitest run tests/skills/sfx-cli.test.ts` · Expected: PASS (ffmpeg·sfxlite 있는 이 맥에서 flow 포함)
    - [x] 커밋: `git add plugins/nereus/skills/sfx/scripts/sfx-cli.mjs tests/skills/sfx-cli.test.ts && git commit -m "feat(sfx): cli build and mix"`
  - Done when: `sfx-cli.test.ts` 전부 PASS, 출력 영상 길이 차 < 0.1 초, audio 스트림 존재

- [x] T9. 라우터 — sfx 라우트, video 에서 효과음 생성 이관
  - Files: Modify `plugins/nereus/hooks/scripts/lib/router.mjs` · Test `tests/lib/router.test.ts`
  - Interfaces: Consumes `routePrompt` · Produces `ROUTES` 에 `nereus:sfx`
  - Steps:
    - [x] 실패 테스트 작성 (`tests/lib/router.test.ts` 끝에 추가):
      ```ts
      describe("router: sfx", () => {
        it("효과음 넣기·찾기·만들기는 nereus:sfx", () => {
          for (const p of ["이 영상에 효과음 넣어줘", "효과음 붙여줘", "효과음 찾아줘", "사운드 이펙트 깔아줘", "add sfx to this clip", "효과음 만들어줘"])
            expect(routePrompt(p).map((h) => h.skill)).toContain("nereus:sfx");
        });
        it("효과음 만들기는 더 이상 video 가 아니다, 립싱크는 video", () => {
          expect(routePrompt("효과음 만들어줘").map((h) => h.skill)).not.toContain("nereus:video");
          expect(routePrompt("립싱크 영상 만들어").map((h) => h.skill)).toContain("nereus:video");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: FAIL (sfx 라우트 없음)
    - [x] 최소 구현: `nereus:video` 정규식에서 `|효과음\s?(만들|생성)` 제거. 그 바로 앞에 `{ skill: "nereus:sfx", why: "영상 효과음 — 합성·무료 검색·배치·크레딧", re: /(효과음\s?(을|를)?\s?(넣|붙|깔|찾|입혀|만들|생성|골라)|사운드\s?이펙트|\bsfx\b|sound\s?effects?)/i }` 추가
    - [x] 통과 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/router.mjs tests/lib/router.test.ts && git commit -m "feat(router): route sfx requests to nereus:sfx"`
  - Done when: `router.test.ts` 전부 PASS (기존 케이스 포함)

- [x] T10. SKILL.md 와 연결 문서
  - Files: Create `plugins/nereus/skills/sfx/SKILL.md` · Modify `plugins/nereus/skills/montage/SKILL.md` · Modify `plugins/nereus/skills/video/SKILL.md`
  - Interfaces: Consumes T8 CLI · Produces 스킬 문서
  - Steps:
    - [x] SKILL.md 작성: frontmatter(name `sfx`, description 에 트리거 "효과음 넣어", "sfx", "사운드 이펙트"), 0 언제 오나(표: 효과음=여기 · 클립 생성=video · 여러 씬=montage · 믹스 이펙트=hyperframes-audio), 1 설치(`git clone` + `git checkout c91a7c9…` + `.venv` + `pip install numpy==2.4.6 scipy==1.17.1`, PyPI `earshot` 금지), 2 절차(큐 작성 → `scenes` 후보 → `list`/`search` → `build` → `mix` → **사람이 듣는다**), 3 소스 순서(합성 → Openverse → 유료 폴백은 `nereus:video` `--capability audio` 와 budget 게이트 그대로), 4 라이선스 규칙 표, 5 실측 메모(category 필터 0건, 익명 20/분·200/일, duration ms, 프리뷰 MP3)
    - [x] montage SKILL.md 2절 5단계 앞에 "렌더 전 효과음: `nereus:sfx`" 한 줄, 0절 표에 효과음 행 추가
    - [x] video SKILL.md 0절 표의 "음악·효과음" 행 옆에 "무료 효과음은 `nereus:sfx` 먼저" 한 줄
    - [x] 확인: Run `npx vitest run tests/lib tests/skills` · Expected: PASS (스킬 수·프론트매터 검사 포함)
    - [x] 커밋: `git add plugins/nereus/skills/sfx/SKILL.md plugins/nereus/skills/montage/SKILL.md plugins/nereus/skills/video/SKILL.md && git commit -m "docs(sfx): skill and links"`
  - Done when: `npx vitest run` 전부 PASS, `grep -c "nereus:sfx" plugins/nereus/skills/montage/SKILL.md` ≥ 1

## Global Constraints
- 런타임은 Node 20+ 표준 라이브러리만. npm 의존 추가 금지. 외부 실행은 `execFileSync`/`spawnSync` 인자 배열(셸 문자열 금지).
- 순수 모듈은 입력을 변경하지 않는다(새 객체 반환). 파일 300줄 이하.
- 네트워크는 CLI 에서만. 단위 테스트는 네트워크를 타지 않는다(fetch 주입).
- earshot-sfx-lite 는 커밋 `c91a7c9d2690ae658f790859d4ad4004857903dd` 고정. PyPI `earshot` 금지. Real SFX(Clipwing) 코드 차용 금지.
- 기존 미커밋 변경(balance-sim·casual-puzzle·phone SKILL.md·pyc·add-balance-lives-axis)은 건드리지 않는다 — 커밋은 경로를 지정해 `git add`.
- 버전 올림·스킬 수 표기·archive 는 finish 단계에서.
