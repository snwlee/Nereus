// 전화 게이트. nereus:phone 의 call.mjs 를 --approved 로 실행하려 하면 사람에게 권한 창으로 묻는다. 순수 판정.
// 존재 이유(보안 리뷰 2026-09-26 H1): --approved 는 에이전트가 스스로 붙이는 플래그라 사람 승인의 증거가 아니다.
// 발신은 되돌릴 수 없는 외부 행동이므로 Claude Code 권한 창(permissionDecision: "ask")에서 사람이 번호·상대·질문을 보고 누른다.
import path from "node:path";
import { effectiveCwd } from "./video-gate.mjs";

const CALL_RE = /(?:^|[\s;&|("'/])call\.mjs["']?(?=\s)/;
const flag = (command, name) => {
  const m = new RegExp(`--${name}\\s+("[^"]+"|'[^']+'|[^\\s;&|]+)`).exec(command);
  return m ? m[1].replace(/^["']|["']$/g, "") : null;
};
const oneLine = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

export function callSummary(brief, to = null) {
  const qs = (brief.questions || []).map((q, i) => `${i + 1}) ${oneLine(q)}`).join(" ");
  return oneLine(`📞 ${oneLine(brief.target)} · ${to || oneLine(brief.to)} · ${brief.language || "?"} · 질문: ${qs}${brief.mayCommit?.length ? ` · 확정 허용: ${brief.mayCommit.map(oneLine).join(" / ")}` : " · 확정 안 함"}`);
}

/** @returns {{decision:"ask", reason:string} | null} */
export function phoneGateVerdict({ command, cwd, readFile }) {
  const cmd = String(command ?? "");
  if (!CALL_RE.test(cmd) || !/--approved\b/.test(cmd)) return null;
  const to = flag(cmd, "to");
  const briefPath = flag(cmd, "brief");
  let summary;
  try {
    summary = callSummary(JSON.parse(readFile(path.resolve(effectiveCwd(cmd, cwd), briefPath || ""))), to);
  } catch (e) {
    summary = `📞 브리프를 읽지 못했습니다(${briefPath || "경로 없음"}: ${e.message})${to ? ` · 번호 ${to}` : ""}`;
  }
  return { decision: "ask", reason: `[nereus:phone] AI 가 실제로 전화를 겁니다 — ${summary}. 이 통화를 허용하려면 승인하세요.` };
}
