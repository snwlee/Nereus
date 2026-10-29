#!/usr/bin/env node
// nereus:sfx CLI — 큐 목록을 효과음 파일·믹스 계획·크레딧으로 만들고 영상에 섞는다.
// stdout 에는 JSON 하나. 종료코드 0=성공 · 1=입력/판정 오류 · 2=도구 없음.
// 외부 실행은 전부 인자 배열(셸 없음).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { classifyLicense } from "./license.mjs";
import { parseSceneTimes, sceneArgs } from "./scenes.mjs";
import { SFXLITE_COMMIT, SFXLITE_REPO, buildRenderArgs, parseList, parseRenderLine, sfxliteHome, sfxlitePython } from "./sfxlite.mjs";
import { search } from "./openverse.mjs";
import { delayMs, parseCues } from "./cues.mjs";
import { buildMixArgs } from "./mix.mjs";
import { renderSoundsMd } from "./credits.mjs";
import { downloadTo } from "./download.mjs";

const EXIT = { ok: 0, input: 1, tool: 2 };
const DURATION_TOLERANCE_SEC = 0.1;

class CliError extends Error {
  constructor(message, code = EXIT.input) { super(message); this.code = code; }
}

const out = (obj) => process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const flags = {};
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith("--")) { pos.push(rest[i]); continue; }
    const next = rest[i + 1];
    flags[rest[i].slice(2)] = next === undefined || next.startsWith("--") ? true : rest[++i];
  }
  return { cmd, flags, pos };
}

const tail = (s, n) => String(s ?? "").trim().split("\n").slice(-n).join(" | ");

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error?.code === "ENOENT") throw new CliError(`${bin} not found`, EXIT.tool);
  if (r.status !== 0) throw new CliError(`${bin} failed (${r.status}): ${tail(r.stderr, 3)}`);
  return r;
}

const hasBin = (bin) => spawnSync(bin, ["-version"], { encoding: "utf8" }).status === 0;

function sfxlite(args) {
  const home = sfxliteHome();
  if (!existsSync(join(home, "sfxlite"))) throw new CliError(`earshot-sfx-lite not installed at ${home} — run: sfx-cli doctor`, EXIT.tool);
  const python = sfxlitePython(home);
  const r = spawnSync(python, args, { cwd: home, encoding: "utf8" });
  if (r.error?.code === "ENOENT") throw new CliError(`${python} not found — run: sfx-cli doctor`, EXIT.tool);
  if (r.status !== 0) throw new CliError(`sfxlite failed: ${tail(r.stderr || r.stdout, 2)}`);
  return r.stdout;
}

// 출력한 설치 명령을 사람이 복사해 실행한다 — 경로를 단일 인용부호로 감싼다.
const shQuote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

function doctor() {
  const home = sfxliteHome();
  const missing = [
    ...(hasBin("ffmpeg") ? [] : ["ffmpeg"]),
    ...(hasBin("ffprobe") ? [] : ["ffprobe"]),
    ...(existsSync(join(home, "sfxlite")) ? [] : ["earshot-sfx-lite"]),
  ];
  const install = [
    `git clone ${SFXLITE_REPO} ${shQuote(home)}`,
    `git -C ${shQuote(home)} checkout ${SFXLITE_COMMIT}`,
    `python3 -m venv ${shQuote(`${home}/.venv`)} && ${shQuote(`${home}/.venv/bin/pip`)} install numpy==2.4.6 scipy==1.17.1`,
  ];
  const ok = missing.length === 0;
  out({ ok, missing, sfxliteHome: home, python: ok ? sfxlitePython(home) : null, ...(ok ? {} : { install }) });
  return ok ? EXIT.ok : EXIT.tool;
}

function scenes({ pos, flags }) {
  if (!pos[0]) throw new CliError("usage: scenes VIDEO [--threshold 0.3] [--gap 0.25]");
  let args;
  try {
    args = sceneArgs(pos[0], flags.threshold ? Number(flags.threshold) : undefined);
  } catch (err) {
    throw new CliError(err.message);
  }
  const r = run("ffmpeg", args);
  const gap = flags.gap === undefined ? undefined : Number(flags.gap);
  if (gap !== undefined && (!Number.isFinite(gap) || gap < 0)) throw new CliError(`--gap must be a number >= 0: ${flags.gap}`);
  out({ video: pos[0], times: parseSceneTimes(r.stderr, gap === undefined ? {} : { minGapSec: gap }) });
  return EXIT.ok;
}

function list({ flags }) {
  const args = ["-m", "sfxlite", "list", ...(typeof flags.kind === "string" ? ["--kind", flags.kind] : [])];
  out({ sounds: parseList(sfxlite(args)) });
  return EXIT.ok;
}

async function searchCmd({ pos, flags }) {
  if (!pos.length) throw new CliError("usage: search QUERY [--n 10]");
  out({ query: pos.join(" "), hits: await search(pos.join(" "), { pageSize: flags.n ? Number(flags.n) : undefined }) });
  return EXIT.ok;
}

const slug = (s) => String(s).replace(/[^a-z0-9_]+/gi, "__");

async function synthCue(cue, n, dir) {
  const file = join(dir, `${n}-${slug(cue.id)}.wav`);
  const res = parseRenderLine(sfxlite(buildRenderArgs({ id: cue.id, out: file, dur: cue.dur, apex: cue.apex, pitch: cue.pitch, seed: cue.seed })));
  if (!res) throw new CliError(`sfxlite render gave no result line for ${cue.id}`);
  return { file, peakSec: res.peakSec, credit: { t: cue.t, sound: cue.id, source: "sfxlite", license: "synth" } };
}

async function sourcedCue(cue, n, dir) {
  const { license } = classifyLicense(cue.license);
  const credit = { t: cue.t, sound: cue.title ?? cue.file ?? cue.url, source: cue.source ?? (cue.url ? "openverse" : "local"), license, attribution: cue.attribution };
  if (cue.file) {
    if (!existsSync(cue.file)) throw new CliError(`file not found: ${cue.file}`);
    return { file: resolve(cue.file), peakSec: cue.apex ?? 0, credit };
  }
  const ext = /\.(mp3|wav|ogg|flac)(\?|$)/i.exec(cue.url)?.[1] ?? "mp3";
  const file = join(dir, `${n}-download.${ext}`);
  try {
    await downloadTo(cue.url, file);
  } catch (err) {
    throw new CliError(err.message);
  }
  return { file, peakSec: cue.apex ?? 0, credit };
}

async function build({ pos, flags }) {
  if (!pos[0] || typeof flags.dir !== "string") throw new CliError("usage: build CUES.json --dir OUTDIR");
  const { cues, errors } = parseCues(JSON.parse(readFileSync(pos[0], "utf8")));
  if (errors.length) throw new CliError(`invalid cues: ${JSON.stringify(errors)}`);
  // 차단 라이선스는 렌더·다운로드 전에 전부 거른다 — 반쯤 만든 결과를 남기지 않는다.
  const blocked = cues.filter((c) => !c.id && classifyLicense(c.license).verdict === "block");
  if (blocked.length) throw new CliError(`blocked license in ${blocked.length} cue(s): ${blocked.map((c) => `t=${c.t} ${c.license || "(none)"}`).join(", ")}`);
  mkdirSync(flags.dir, { recursive: true });
  const made = [];
  for (const [i, cue] of cues.entries()) {
    const n = String(i + 1).padStart(2, "0");
    made.push({ cue, ...(await (cue.id ? synthCue(cue, n, flags.dir) : sourcedCue(cue, n, flags.dir))) });
  }
  const tracks = made.map(({ cue, file, peakSec }) => ({ t: cue.t, file, delayMs: delayMs(cue.t, peakSec), gainDb: cue.gainDb }));
  const soundsMd = renderSoundsMd(made.map((m) => m.credit));
  writeFileSync(join(flags.dir, "sfx-plan.json"), `${JSON.stringify({ tracks }, null, 2)}\n`);
  writeFileSync(join(flags.dir, "SOUNDS.md"), soundsMd);
  out({ dir: flags.dir, tracks, sounds: join(flags.dir, "SOUNDS.md") });
  return EXIT.ok;
}

const probe = (file, entries) => run("ffprobe", ["-v", "error", "-protocol_whitelist", "file", "-show_entries", entries, "-of", "csv=p=0", `file:${file}`]).stdout.trim();

function mix({ pos, flags }) {
  if (!pos[0] || typeof flags.plan !== "string" || typeof flags.out !== "string") throw new CliError("usage: mix VIDEO --plan sfx-plan.json --out OUT.mp4");
  const { tracks } = JSON.parse(readFileSync(flags.plan, "utf8"));
  const missing = [pos[0], ...(tracks ?? []).map((t) => t.file)].filter((f) => typeof f !== "string" || !existsSync(f));
  if (missing.length) throw new CliError(`input not found: ${missing.join(", ")}`);
  const hasAudio = probe(pos[0], "stream=codec_type").split("\n").includes("audio");
  let args;
  try {
    args = buildMixArgs({ video: pos[0], out: flags.out, tracks, hasAudio });
  } catch (err) {
    throw new CliError(`invalid plan: ${err.message}`);
  }
  run("ffmpeg", args);
  const srcDurationSec = Number(probe(pos[0], "format=duration"));
  const durationSec = Number(probe(flags.out, "format=duration"));
  const ok = Math.abs(durationSec - srcDurationSec) < DURATION_TOLERANCE_SEC;
  out({ out: flags.out, hasAudio, srcDurationSec, durationSec, ok, next: "사람이 듣고 판정한다 — Claude 는 들을 수 없다" });
  return ok ? EXIT.ok : EXIT.input;
}

const COMMANDS = { doctor, scenes, list, search: searchCmd, build, mix };

async function main(argv) {
  const parsed = parseArgs(argv);
  const fn = COMMANDS[parsed.cmd];
  if (!fn) throw new CliError(`unknown command: ${parsed.cmd ?? "(none)"} — one of ${Object.keys(COMMANDS).join(", ")}`);
  return fn(parsed);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`sfx: ${err.message}\n`);
    process.exit(err instanceof CliError ? err.code : EXIT.input);
  },
);
