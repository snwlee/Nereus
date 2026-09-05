// 학습 규칙 추가·조회. 같은 규칙을 다시 넣으면 신뢰도가 올라간다.
// 사용: node learn.mjs add --trigger "<언제>" --rule "<무엇을>" [--source correction|failure|preference] [--global]
//       node learn.mjs list [--all]
import { append, readAll, learningsPath, parseLearnings } from "../../../hooks/scripts/lib/learnings.mjs";
import fs from "node:fs";

if (process.argv[1] && /learn\.mjs$/.test(process.argv[1])) {
  const cwd = process.cwd();
  const cmd = process.argv[2] ?? "list";
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  const scope = process.argv.includes("--global") ? "global" : "project";

  if (cmd === "add") {
    const rule = arg("--rule");
    if (!rule) { console.error('--rule "<무엇을>" 이 필요합니다.'); process.exit(2); }
    const next = append(cwd, { trigger: arg("--trigger", ""), rule, source: arg("--source", "correction") }, scope);
    const saved = next.find((e) => e.rule === rule);
    console.log(`저장됨 (${scope}, 신뢰도 ${saved.confidence}, ${saved.hits}회) → ${learningsPath(cwd, scope)}`);
  } else {
    const entries = process.argv.includes("--all")
      ? readAll(cwd)
      : (() => { try { return parseLearnings(fs.readFileSync(learningsPath(cwd, scope), "utf8")); } catch { return []; } })();
    if (!entries.length) { console.log("저장된 규칙이 없습니다."); process.exit(0); }
    for (const e of entries.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))) {
      console.log(`[${(e.confidence ?? 0).toFixed(1)}] ${e.trigger ? e.trigger + ": " : ""}${e.rule}  (${e.source}, ${e.hits}회)`);
    }
  }
}
