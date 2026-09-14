#!/usr/bin/env node
// Muapi 생성 CLI — `nereus:video` 의 실행 경로.
//
//   node muapi-cli.mjs summary [--json]
//   node muapi-cli.mjs models <capability> [--json]
//   node muapi-cli.mjs generate --capability t2v --prompt "..." [--model id]
//                               [--input k=v ...] [--out DIR] [--name NAME]
//
// 카탈로그 조회는 **키 없이도 된다** — 네트워크를 타지 않는다.
// 생성만 MUAPI_API_KEY 를 요구하고, 없으면 조용히 죽지 않고 사유를 밝힌다.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { catalogSummary, pickModels } from "./muapi-catalog.mjs";
import { requireKey, resolveModel, buildRequest, resultUrl } from "./muapi-client.mjs";

const POLL_MS = 3000;
const POLL_LIMIT = 200; // 약 10분. 영상은 오래 걸린다.

function parseArgs(argv) {
  const out = { _: [], inputs: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--input") {
      const [k, ...rest] = String(argv[++i] ?? "").split("=");
      if (k) out.inputs[k] = rest.join("=");
    } else if (a.startsWith("--")) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(args) {
  const key = requireKey();
  const model = resolveModel({ capability: args.capability, model: args.model });
  if (!args.prompt) throw new Error("--prompt 가 없다");
  const req = buildRequest({ endpoint: model.endpoint, prompt: args.prompt, key, inputs: args.inputs });

  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  if (!res.ok) throw new Error(`생성 요청이 거부됐다 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  const { request_id: id } = await res.json();
  if (!id) throw new Error("상류가 request_id 를 주지 않았다");

  for (let i = 0; i < POLL_LIMIT; i += 1) {
    await sleep(POLL_MS);
    const r = await fetch(resultUrl(id), { headers: { "x-api-key": key } });
    if (!r.ok) continue;
    const j = await r.json();
    if (j.status === "completed") {
      const url = j.outputs?.[0]?.url ?? j.output?.url ?? j.url;
      if (!url) throw new Error(`완료됐는데 결과 URL 이 없다: ${JSON.stringify(j).slice(0, 300)}`);
      const outDir = args.out ?? ".";
      fs.mkdirSync(outDir, { recursive: true });
      const ext = path.extname(new URL(url).pathname) || ".bin";
      const file = path.join(outDir, `${args.name ?? model.id}${ext}`);
      const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
      fs.writeFileSync(file, bin);
      return { saved: file, model: model.id, requestId: id, bytes: bin.length };
    }
    if (j.status === "failed") throw new Error(`생성 실패: ${j.error ?? "상류가 사유를 주지 않았다"}`);
  }
  throw new Error(`${(POLL_MS * POLL_LIMIT) / 1000}초 안에 끝나지 않았다 (request_id ${id})`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (cmd === "summary") {
    const s = catalogSummary();
    process.stdout.write(args.json ? `${JSON.stringify(s, null, 2)}\n`
      : `${Object.entries(s).map(([k, v]) => `${k.padEnd(14)} ${v}`).join("\n")}\n`);
    return;
  }
  if (cmd === "models") {
    const list = pickModels(args._[0]);
    process.stdout.write(args.json ? `${JSON.stringify(list, null, 2)}\n`
      : `${list.map((m) => `${m.id}\t${m.name}`).join("\n")}\n`);
    return;
  }
  if (cmd === "generate") {
    process.stdout.write(`${JSON.stringify(await generate(args), null, 2)}\n`);
    return;
  }
  throw new Error(`모르는 명령 '${cmd ?? ""}'. summary | models <능력> | generate`);
}

// 성공 경로에서 process.exit(0) 을 부르지 않는다 — 파이프 출력이 잘린다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    if (process.env.NEREUS_DEBUG) throw e;
    process.stderr.write(`${e?.message ?? e}\n`);
    process.exit(1);
  });
}
