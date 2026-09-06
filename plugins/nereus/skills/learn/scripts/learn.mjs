// 학습 규칙 관리. 훅이 모은 후보를 사람이 승인해야 규칙이 된다.
// 사용:
//   node learn.mjs review                         승인 대기 후보 보기
//   node learn.mjs approve <id> --trigger "<언제>" --rule "<무엇을>" [--global]
//   node learn.mjs decline <id>
//   node learn.mjs add --trigger "<언제>" --rule "<무엇을>" [--source ...] [--global]   후보 없이 직접 추가
//   node learn.mjs list [--all]
import fs from "node:fs";
import { append, readAll, learningsPath, parseLearnings } from "../../../hooks/scripts/lib/learnings.mjs";
import { readCandidates, writeCandidates, aggregate } from "../../../hooks/scripts/session-end.mjs";

const TYPE_LABEL = { correction: "교정", fail_then_fix: "실패→통과", repeated_command: "반복 명령" };

if (process.argv[1] && /learn\.mjs$/.test(process.argv[1])) {
  const cwd = process.cwd();
  const cmd = process.argv[2] ?? "review";
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  const scope = process.argv.includes("--global") ? "global" : "project";

  if (cmd === "review") {
    aggregate(cwd); // 아직 집계되지 않은 관찰이 있으면 먼저 반영
    const open = readCandidates(cwd).filter((c) => c.status === "open").sort((a, b) => (b.hits ?? 1) - (a.hits ?? 1));
    if (!open.length) { console.log("승인 대기 후보가 없습니다."); process.exit(0); }
    console.log(`승인 대기 ${open.length}건\n`);
    for (const c of open) {
      console.log(`[${c.id}] ${TYPE_LABEL[c.type] ?? c.type} · ${c.hits}회`);
      console.log(`  ${c.key}`);
      if (c.evidence?.length) console.log(`  근거: ${c.evidence.join(", ")}`);
    }
    console.log('\n승인: learn.mjs approve <id> --trigger "<언제>" --rule "<무엇을>"   |   기각: learn.mjs decline <id>');
  } else if (cmd === "approve" || cmd === "decline") {
    const id = process.argv[3];
    const list = readCandidates(cwd);
    const hit = list.find((c) => c.id === id);
    if (!hit) { console.error(`후보 ${id} 를 찾지 못했습니다. review 로 목록을 보세요.`); process.exit(2); }
    if (cmd === "decline") {
      writeCandidates(cwd, list.map((c) => (c.id === id ? { ...c, status: "declined" } : c)));
      console.log(`[${id}] 기각. 다시 올라오지 않습니다.`);
    } else {
      const rule = arg("--rule");
      if (!rule) { console.error('--rule "<무엇을>" 이 필요합니다.'); process.exit(2); }
      const next = append(cwd, { trigger: arg("--trigger", ""), rule, source: hit.type }, scope);
      writeCandidates(cwd, list.map((c) => (c.id === id ? { ...c, status: "approved" } : c)));
      const saved = next.find((e) => e.rule === rule);
      console.log(`[${id}] 승인 → 규칙 저장 (${scope}, 신뢰도 ${saved.confidence}, ${saved.hits}회)`);
    }
  } else if (cmd === "add") {
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
