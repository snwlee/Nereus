// 하네스 어댑터. Claude Code·Codex·OpenCode(브릿지)의 훅 페이로드를 하나로 정규화한다.
// 배경: 세 하네스의 이벤트명(SessionStart·PreToolUse·PostToolUse·Stop·PreCompact)은 같고,
// 입력 JSON도 session_id·cwd·tool_name·tool_input 뼈대가 같다. 다른 것은 파일 편집 경로뿐이다.
// (Claude: Edit|Write file_path, Codex: apply_patch patch 문자열, OpenCode: 브릿지가 Claude형으로 변환)
// 차단 계약도 셋 다 같다: exit 2 + stderr 사유. 그래서 스크립트는 이 정규형만 보면 된다.
//
// OpenCode 브릿지 계약: .opencode 플러그인이 tool.execute.before/after를 받아 아래 형태로 표준입력에
// 넣어 기존 스크립트를 그대로 호출한다. {harness:"opencode"} 마커 필수.
// Codex 주의: PreToolUse deny가 apply_patch에 안 먹히는 버전이 보고됨(상류 이슈 #27833).
// 그래서 TDD 강제(enforce:block)는 Claude에서만 하드 차단이고, Codex에서는 PostToolUse 경고 +
// finish 게이트가 최종 방어선이다. 가드레일이지 보안 경계가 아니다.

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "apply_patch"]);
const EXEC_TOOLS = new Set(["Bash", "shell", "exec", "exec_command"]);
const PATCH_FILE_RE = /^\*\*\*\s+(?:Update File|Add File|Delete File|Rename File):\s*(.+?)\s*$/;

/** 페이로드가 어느 하네스에서 왔는지 판별. 모호하면 claude(기존 동작 유지). */
export function detectHarness(input = {}) {
  if (input?.harness === "opencode") return "opencode";
  if ("turn_id" in input || "model" in input || "permission_mode" in input) return "codex";
  return "claude";
}

function patchFiles(patch) {
  const out = [];
  for (const line of String(patch ?? "").split("\n")) {
    const m = line.match(PATCH_FILE_RE);
    if (m) out.push(m[1]);
  }
  return [...new Set(out)];
}

/** tool_input에서 편집 파일 목록을 뽑는다. 하네스별 필드 차이를 여기서 흡수한다. */
export function extractFiles(toolInput = {}) {
  const ti = toolInput ?? {};
  const out = [];
  const push = (v) => { if (typeof v === "string" && v) out.push(v); };
  push(ti.file_path);
  if (Array.isArray(ti.files)) ti.files.forEach(push);
  if (Array.isArray(ti.edits)) ti.edits.forEach((e) => push(e?.file_path));
  push(ti.path ?? ti.file ?? ti.filename);
  for (const f of patchFiles(ti.patch)) out.push(f);
  return [...new Set(out)];
}

/** 훅 입력을 정규형으로. {harness, event, tool, kind, files, command, cwd, sessionId} */
export function normalizeToolEvent(input = {}) {
  const harness = detectHarness(input);
  const tool = input?.tool_name ?? "";
  const ti = input?.tool_input ?? {};
  const kind = EDIT_TOOLS.has(tool) ? "edit" : EXEC_TOOLS.has(tool) ? "exec" : "other";
  return {
    harness,
    event: input?.hook_event_name ?? "",
    tool,
    kind,
    files: kind === "edit" ? extractFiles(ti) : [],
    command: typeof ti.command === "string" ? ti.command : null,
    cwd: input?.cwd || process.cwd(),
    sessionId: input?.session_id || "nosession",
  };
}
