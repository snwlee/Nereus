// 통화 기록(jsonl) 파서. relay.mjs 가 한 줄에 {t, who, text} 로 남긴다 — who: 상대 · AI · system.
// 사용: node transcript.mjs [CALL_SID]   — 없으면 가장 최근 통화.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ERROR_MARK = /(error|실패)/i;

export function parseLog(text) {
  const recs = String(text).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  const system = recs.filter((r) => r.who === "system");
  const has = (s) => system.some((r) => r.text === s);
  const endedBy = has("end_call") ? "ai" : has("stop") ? "remote" : null;
  const start = system.find((r) => r.text.startsWith("start job="));
  return {
    job: start ? start.text.slice("start job=".length) : null,
    turns: recs.filter((r) => r.who !== "system"),
    ended: endedBy !== null,
    endedBy,
    errors: system.filter((r) => ERROR_MARK.test(r.text)).map((r) => r.text),
  };
}

export const formatTurns = (turns) => turns.map((r) => `${r.t.slice(11, 19)} ${r.who}: ${r.text}`).join("\n");

async function main() {
  const { paths } = await import("./config.mjs");
  const dir = paths().logs;
  const sid = process.argv[2];
  const file = sid ? `${sid}.jsonl` : fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
    .sort((a, b) => fs.statSync(path.join(dir, a)).mtimeMs - fs.statSync(path.join(dir, b)).mtimeMs).pop();
  if (!file) { console.error("기록 없음"); process.exit(1); }
  const r = parseLog(fs.readFileSync(path.join(dir, file), "utf8"));
  console.log(formatTurns(r.turns));
  console.log(JSON.stringify({ call: file.replace(/\.jsonl$/, ""), job: r.job, ended: r.ended, endedBy: r.endedBy, errors: r.errors }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
