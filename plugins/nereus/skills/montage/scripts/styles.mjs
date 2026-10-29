#!/usr/bin/env node
// montage 스타일 단계 CLI — Lemo-Opuscar 카탈로그에서 후보를 고르고 동반 도구를 판정한다.
// stdout 에는 JSON 하나. 종료코드 0=성공 · 1=입력 오류 · 2=Lemo 없음.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeStyle, pickStyles } from "./style-catalog.mjs";
import { companionVerdict, COMPANIONS } from "./style-companions.mjs";

const EXIT = { ok: 0, input: 1, missing: 2 };
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

class CliError extends Error {
  constructor(message, code = EXIT.input) { super(message); this.code = code; }
}

function lemoHome(env = process.env) {
  return env.NEREUS_LEMO || join(env.HOME ?? "", ".local/share/nereus/montage/lemo-opuscar");
}

const out = (obj) => process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
const shQuote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

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

function stylesDir() {
  const home = lemoHome();
  const dir = join(home, "styles");
  if (!existsSync(dir)) {
    throw new CliError(`Lemo-Opuscar not found at ${home} — install as a library (not a plugin):\n  git clone ${COMPANIONS["lemo-opuscar"].repo} ${shQuote(home)}`, EXIT.missing);
  }
  return dir;
}

// 폴더마다 style.json 을 읽는다. 깨진 json 은 경고하고 건너뛴다 — 하나 때문에 카탈로그 전체를 잃지 않는다.
function loadCatalog() {
  const dir = stylesDir();
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const file = join(dir, d.name, "style.json");
      if (!existsSync(file)) return [];
      try {
        const s = normalizeStyle(JSON.parse(readFileSync(file, "utf8")));
        return s ? [s] : [];
      } catch (err) {
        process.stderr.write(`styles: skip ${d.name}/style.json (${err.message})\n`);
        return [];
      }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function doctor() {
  const home = lemoHome();
  const styles = loadCatalog();
  const head = spawnSync("git", ["-C", home, "rev-parse", "HEAD"], { encoding: "utf8" });
  out({ ok: true, lemoHome: home, commit: head.status === 0 ? head.stdout.trim() : null, styles: styles.length });
  return EXIT.ok;
}

function list({ flags }) {
  const cat = typeof flags.category === "string" ? flags.category.toLowerCase() : null;
  const styles = loadCatalog().filter((s) => !cat || s.category.toLowerCase().includes(cat));
  out({ styles: styles.map(({ slug, name, category, uses }) => ({ slug, name, category, uses })) });
  return EXIT.ok;
}

function pick({ pos, flags }) {
  if (!pos.length) throw new CliError('usage: pick "english keywords" [--commercial] [--n 5]');
  const n = flags.n === undefined ? undefined : Number(flags.n);
  if (n !== undefined && !(Number.isInteger(n) && n > 0)) throw new CliError(`--n must be a positive integer: ${flags.n}`);
  const picks = pickStyles(loadCatalog(), pos.join(" "), { commercial: flags.commercial === true, n });
  out({ brief: pos.join(" "), commercial: flags.commercial === true, picks, next: "후보를 사용자에게 보이고, 고른 STYLE.md 를 show 로 읽어 장면 지시로 옮긴다" });
  return EXIT.ok;
}

function show({ pos }) {
  const slug = pos[0];
  if (!SLUG_RE.test(String(slug ?? ""))) throw new CliError(`invalid slug: ${slug}`);
  const style = loadCatalog().find((s) => s.slug === slug);
  if (!style) throw new CliError(`unknown style: ${slug}`);
  const path = join(stylesDir(), slug, "STYLE.md");
  if (!existsSync(path)) throw new CliError(`STYLE.md missing for ${slug}`);
  out({ ...style, path, body: readFileSync(path, "utf8") });
  return EXIT.ok;
}

function companion({ pos, flags }) {
  if (!pos.length) throw new CliError("usage: companion NAME [--commercial] [--named] [--paid-key]");
  const name = pos.join(" ");
  out({ name, ...companionVerdict(name, { commercial: flags.commercial === true, named: flags.named === true, paidKey: flags["paid-key"] === true }) });
  return EXIT.ok;
}

const COMMANDS = { doctor, list, pick, show, companion };

function main(argv) {
  const parsed = parseArgs(argv);
  const fn = COMMANDS[parsed.cmd];
  if (!fn) throw new CliError(`unknown command: ${parsed.cmd ?? "(none)"} — one of ${Object.keys(COMMANDS).join(", ")}`);
  return fn(parsed);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    process.stderr.write(`styles: ${err.message}\n`);
    process.exit(err instanceof CliError ? err.code : EXIT.input);
  }
}
