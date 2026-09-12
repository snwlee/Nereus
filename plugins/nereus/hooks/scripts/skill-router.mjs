// UserPromptSubmit: 요청 내용을 보고 해당 Nereus 스킬을 지목한다.
// 같은 스킬은 세션당 한 번만 지목한다 — 반복 잔소리는 무시되고 토큰만 쓴다.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { projectStateDir } from "./lib/paths.mjs";
import { routePrompt, routerNotice } from "./lib/router.mjs";
import { loadExtensions } from "./lib/extensions.mjs";

const seenFile = (cwd, sid) => path.join(projectStateDir(cwd), `.routed-${String(sid).replace(/[^A-Za-z0-9_-]/g, "_")}`);

export function parseSeen(text) {
  return String(text ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const file = seenFile(cwd, input.session_id ?? "nosession");
  const readSeen = deps.readSeen ?? (() => { try { return fs.readFileSync(file, "utf8"); } catch { return ""; } });
  const writeSeen = deps.writeSeen ?? ((s) => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, s); } catch { /* 무시 */ } });

  const seen = parseSeen(readSeen());
  // 형제 플러그인(예: nereus-game)의 라우트를 함께 본다. 코어 라우트가 항상 앞이다.
  const extraRoutes = (deps.extensions ?? (() => loadExtensions()))().routes;
  const hits = routePrompt(input.prompt, { seen, extraRoutes });
  if (!hits.length) return null;

  writeSeen([...seen, ...hits.map((h) => h.skill)].join("\n") + "\n");
  return contextPayload("UserPromptSubmit", routerNotice(hits));
}

if (process.argv[1] && /skill-router\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
