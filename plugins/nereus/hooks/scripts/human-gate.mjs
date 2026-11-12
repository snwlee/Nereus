// 사람 개입은 최후순위. 두 지점에서 한 번씩 되묻는다. fail-open.
// - PreToolUse(AskUserQuestion): 처음 보는 질문을 한 번 되돌려 점검 목록을 보게 한다. 같은 질문을 다시 부르면 통과.
// - Stop: 사람에게 일을 넘기며 멈추려 하면 한 번 막는다. stop_hook_active 면 통과(무한 루프 방지).
// 막는 것이 아니라 "먼저 확인했는가"를 강제하는 것이다. 확인을 마쳤다면 같은 행동을 한 번 더 하면 된다.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readStdinJson, emit } from "./lib/io.mjs";
import { projectStateDir } from "./lib/paths.mjs";

// session-start 가 매 컨텍스트에 심는다. 훅이 못 잡는 경로(그냥 글로 묻고 끝내기 직전 등)를 위한 기본 규칙.
export const HUMAN_LAST_POLICY =
  "사람 개입(구매·결제·로그인·키 발급·승인·실기기 조작 등)은 최후순위다. 진짜 급한 것이 아니면 맨 뒤로 미룬다. "
  + "요청하기 전에 (1) AI 가 직접 처리할 수단이 정말 없는지 — CLI·API·MCP·브라우저 자동화·대체 서비스·임시값·목업까지 — 먼저 찾고, "
  + "(2) 그 개입과 무관한 나머지 일을 전부 끝내 둔다(예: 도메인 구매가 필요하면 사이트를 먼저 다 만들고 배포 직전 상태로 둔다). "
  + "사람이 그 하나만 하면 끝나는 상태일 때만 요청하고, 그때는 할 일을 한 번에 모아 정확한 절차와 함께 준다.";

const CHECKLIST = [
  "1. AI 가 직접 처리할 수 없는가? CLI·API·MCP·브라우저 자동화·저장된 자격 증명(credstore)·무료 대체·임시값/목업으로 우회할 길을 먼저 찾았는가.",
  "2. 이 개입과 무관한 나머지 일을 전부 끝냈는가? 개입 뒤에 남는 일이 '사람이 그 하나를 하면 바로 끝나는' 수준인가.",
  "3. 정말 지금 당장 필요한가? 아니면 맨 뒤로 미루고 나머지를 먼저 진행할 수 있는가.",
  "4. 요청은 한 번에 모았는가? 사람이 할 일을 정확한 절차·위치와 함께 하나의 목록으로 준다.",
].join("\n");

// ── PreToolUse ───────────────────────────────────────────────────────────────

/** 질문 문구로만 지문을 만든다. 같은 질문을 다시 부르면 '점검을 마쳤다'는 뜻으로 본다. */
export function fingerprint(toolInput) {
  const qs = (toolInput?.questions ?? []).map((q) => String(q?.question ?? "").trim());
  return crypto.createHash("sha1").update(qs.join("\n")).digest("hex").slice(0, 16);
}

const MAX_SEEN = 200;

function fileStore(cwd, sessionId) {
  const f = path.join(projectStateDir(cwd), "human-gate", `${String(sessionId || "nosession").slice(0, 16)}.json`);
  return {
    load: () => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; } },
    save: (seen) => {
      try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(seen)); } catch { /* fail-open */ }
    },
  };
}

export function handlePreTool(input, store) {
  if (input?.tool_name !== "AskUserQuestion") return null;
  const s = store ?? fileStore(input.cwd || process.cwd(), input.session_id);
  const fp = fingerprint(input.tool_input);
  const seen = s.load();
  if (seen.includes(fp)) return null;
  s.save([...seen, fp].slice(-MAX_SEEN));
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "[nereus:human-gate] 사람 개입은 최후순위입니다. 묻기 전에 확인하세요:\n" + CHECKLIST
        + "\n하나라도 아니면 질문하지 말고 그 일부터 하세요. 전부 그렇다면 같은 질문을 그대로 다시 부르면 통과합니다."
        + " (순서·착수 승인 질문은 애초에 하지 않습니다.)",
    },
  };
}

// ── Stop ─────────────────────────────────────────────────────────────────────

// 사람에게 행동을 넘기는 문장. "구매 흐름을 구현했다" 같은 보고는 걸리지 않게 요청형 어미와 묶는다.
const HANDOFF_KO = /(구매|결제|로그인|가입|발급|승인|인증|등록|입력|설정|설치|연결|업로드|확인|제공|전달)\s*(을|를)?\s*(해\s*)?(주세요|주시면|주셔야|주실|부탁|해야\s*합니다|필요합니다)|(구매|결제|승인|로그인|발급)이?\s*필요합니다/;
const HANDOFF_EN = /\b(please|you(?:'ll)? need to|once you)\b[^.]{0,40}\b(buy|purchase|pay|log ?in|sign (?:in|up)|provide|approve|install|enter|create|register)\b/i;

export function looksLikeHandoff(text) {
  const t = String(text ?? "");
  if (!t.trim()) return false;
  return HANDOFF_KO.test(t) || HANDOFF_EN.test(t);
}

/** Stop 입력의 last_assistant_message, 없으면 transcript JSONL 끝의 assistant 텍스트. */
export function lastAssistantText(input, readFile = (p) => fs.readFileSync(p, "utf8")) {
  if (typeof input?.last_assistant_message === "string") return input.last_assistant_message;
  if (!input?.transcript_path) return "";
  let raw;
  try { raw = readFile(input.transcript_path); } catch { return ""; }
  const lines = String(raw).split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let rec;
    try { rec = JSON.parse(lines[i]); } catch { continue; }
    const msg = rec?.message;
    if (rec?.type !== "assistant" || msg?.role !== "assistant") continue;
    const content = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: String(msg.content ?? "") }];
    const text = content.filter((c) => c?.type === "text").map((c) => c.text).join("\n").trim();
    if (text) return text;
  }
  return "";
}

export function handleStop(input, deps = {}) {
  if (!input || input.stop_hook_active) return null;
  const text = lastAssistantText(input, deps.readFile);
  if (!looksLikeHandoff(text)) return null;
  return {
    decision: "block",
    reason:
      "[nereus:human-gate] 사람 개입을 요청하며 멈추려 합니다. 사람 개입은 최후순위입니다. 멈추기 전에 확인하세요:\n" + CHECKLIST
      + "\n아직 할 수 있는 일이 있으면 지금 이어서 하세요. 전부 확인했다면 요청 목록을 정리해 그대로 마치면 됩니다(다시 막지 않습니다).",
  };
}

// ── 진입점 ───────────────────────────────────────────────────────────────────

if (process.argv[1] && /human-gate\.mjs$/.test(process.argv[1])) {
  try {
    const input = readStdinJson();
    emit(input.hook_event_name === "Stop" ? handleStop(input) : handlePreTool(input));
  } catch { /* fail-open */ }
}
