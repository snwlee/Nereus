// NDA 경계 가드 (PreToolUse).
//
// 막는 것은 "NDA 경로"가 아니라 **"NDA 경로 + 외부 전송"의 조합**이다.
// NDA 파일을 읽거나 고치는 것을 막으면 그 플랫폼 개발 자체가 불가능해진다.
// 위반은 내용이 밖으로 나가는 순간에 일어난다.
//
// 한계: 이 세션의 모델이 파일을 읽어 컨텍스트에 넣는 것은 기술로 못 막는다.
// 그래서 switch 스킬이 **플랫폼 추상화**를 요구한다 — NDA 구역을 얇게 유지하면 사고 면적이 줄어든다.
// 훅은 사고를 막고 추상화는 면적을 줄인다. 둘 다 필요하다.
//
// 기본은 차단이다. 경고로 두면 언젠가 지나가고, NDA 위반은 되돌릴 수 없다.
import { ndaPathsIn } from "../../lib/nda.mjs";

const EXTERNAL = ["codex", "agy", "ocr", "curl", "wget", "gh", "scp", "rsync"];

/**
 * @param {{tool_name?:string, tool_input?:{command?:string}}} input
 * @param {{mode?:"block"|"warn", extraZones?:string[]}} opts
 * @returns {{block:boolean, reason:string}}
 */
export function ndaGuard(input, opts = {}) {
  const mode = opts.mode ?? "block";
  if (input?.tool_name !== "Bash") return { block: false, reason: "" };

  const command = String(input?.tool_input?.command ?? "");
  const tokens = command.split(/\s+/).filter(Boolean);
  const usesExternal = tokens.some((t) => EXTERNAL.includes(t.replace(/^.*[/\\]/, "")));
  if (!usesExternal) return { block: false, reason: "" };

  const hits = ndaPathsIn(command, opts.extraZones ?? []);
  if (!hits.length) return { block: false, reason: "" };

  const reason =
    `NDA 구역을 외부로 보내려 한다: ${hits.join(", ")}\n` +
    `외부 도구에 NDA 경로를 넘길 수 없다. 플랫폼 무관 층만 리뷰에 넘겨라.`;
  return { block: mode === "block", reason };
}

// 훅 실행 경로. 차단은 종료 코드 2 로 알린다(PreToolUse 규약).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      const r = ndaGuard(JSON.parse(raw || "{}"));
      if (r.reason) process.stderr.write(`[nereus-game] ${r.reason}\n`);
      process.exit(r.block ? 2 : 0);
    } catch {
      process.exit(0); // 훅은 진단 대상 때문에 죽지 않는다
    }
  });
}
