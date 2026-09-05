// PDF 생성기. 기본 Typst, --engine latex 시 xelatex. 템플릿 선택·컴파일·에러 위치 추출.
// 사용: node pdf.mjs <input.md|.typ|.tex> --out <file.pdf> [--template report|adr|research|spec] [--engine typst|latex] [--font "Noto Sans KR"] [--font-dir <dir>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run as defaultRun, which } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES = {
  typst: { report: "report.typ", adr: "adr.typ", research: "research.typ", spec: "spec.typ" },
  latex: { report: "report.tex" },
};

export function pickEngine({ requested, config, available = (b) => !!which(b) }) {
  const want = requested ?? config?.engine ?? "typst";
  if (want === "latex") {
    if (available("xelatex")) return { engine: "latex", bin: "xelatex" };
    if (available("typst")) return { engine: "typst", bin: "typst", fallback: "xelatex 없음" };
    return { engine: null, bin: null, fallback: "xelatex, typst 모두 없음" };
  }
  if (available("typst")) return { engine: "typst", bin: "typst" };
  return { engine: null, bin: null, fallback: "typst 없음" };
}

export function templatePath(engine, name) {
  const file = TEMPLATES[engine]?.[name];
  if (!file) throw new Error(`알 수 없는 템플릿: ${engine}/${name}`);
  return path.join(HERE, "..", "templates", engine, file);
}

export function compile({ engine, bin, input, output, font, fontDir }, { run = defaultRun } = {}) {
  let r;
  if (engine === "typst") {
    const args = ["compile", input, output];
    if (fontDir) args.push("--font-path", fontDir);
    if (font) args.push("--input", `font=${font}`);
    r = run(bin, args, { timeoutMs: 120000 });
  } else {
    r = run(bin, ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${path.dirname(output)}`, input], { timeoutMs: 300000 });
  }
  if (r.ok) return { ok: true, output };
  const loc = (r.stderr + r.stdout).match(/([\w./\\-]+\.(?:typ|tex)):(\d+):(\d+)/) ?? (r.stderr + r.stdout).match(/l\.(\d+)/);
  return { ok: false, error: (loc ? `${loc[0]} — ` : "") + (r.stderr || r.stdout).trim().split("\n").slice(0, 8).join("\n") };
}

// markdown 본문을 Typst 템플릿에 끼워 .typ 생성. 템플릿은 `#let body = [...]` 대신 `#include`로 본문 파일을 읽는다.
export function wrapMarkdownForTypst({ markdown, template, title, font, outDir }) {
  const bodyFile = path.join(outDir, "body.typ");
  fs.writeFileSync(bodyFile, mdToTypst(markdown));
  const main = path.join(outDir, "main.typ");
  fs.writeFileSync(main, `#import "${template.replace(/\\/g, "/")}": doc\n#show: doc.with(title: "${title.replace(/"/g, '\\"')}", font: "${font}")\n#include "body.typ"\n`);
  return main;
}

export function mdToTypst(md) {
  return md.split("\n").map((l) => {
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) return `${"=".repeat(h[1].length)} ${h[2]}`;
    return l.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/`([^`]+)`/g, "`$1`").replace(/^\s*[-*]\s+/, "- ");
  }).join("\n");
}

if (process.argv[1] && /pdf\.mjs$/.test(process.argv[1])) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  const input = process.argv[2];
  const cfg = loadConfig();
  const pick = pickEngine({ requested: arg("--engine"), config: cfg.pdf });
  if (!pick.engine) { console.error(`PDF 엔진 없음: ${pick.fallback}. /nereus:setup 참고.`); process.exit(2); }
  if (pick.fallback) console.error(`[pdf] ${pick.fallback} → ${pick.engine} 사용`);
  const output = arg("--out", input.replace(/\.[^.]+$/, ".pdf"));
  const font = arg("--font", cfg.pdf.font);
  let src = input;
  if (/\.md$/.test(input) && pick.engine === "typst") {
    const outDir = fs.mkdtempSync(path.join(path.dirname(output), ".pdf-"));
    src = wrapMarkdownForTypst({ markdown: fs.readFileSync(input, "utf8"), template: templatePath("typst", arg("--template", "report")), title: arg("--title", path.basename(input, ".md")), font, outDir });
  }
  const r = compile({ ...pick, input: src, output, font, fontDir: arg("--font-dir") });
  if (!r.ok) { console.error(r.error); process.exit(1); }
  console.log(output);
}
