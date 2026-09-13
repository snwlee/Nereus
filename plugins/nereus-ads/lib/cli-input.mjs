// 검사기 CLI 진입점의 공통 stdin 파서.
//
// **이 플러그인의 것이다.** 다른 플러그인에서 import 하지 않는다 —
// 플러그인이 서로의 내부에 붙으면 설치 조합에 따라 조용히 깨진다.
// 두 검사기(ad-policy-check · ad-funnel)가 같은 방식으로 stdin JSON 을 받는다.
// 각자 `JSON.parse(...)` 를 부르면 깨진 입력에 SyntaxError 스택트레이스만 뱉는다 —
// 실패하는 것은 맞지만 **왜** 실패했는지 알 수 없다. 사유 있는 오류로 바꾼다.
import { readFileSync } from "node:fs";

/** stdin 문자열을 객체로. 빈 입력은 빈 객체, 깨진 JSON 은 사유 있는 오류다. */
export function parseCliInput(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`stdin 으로 받은 JSON 을 읽을 수 없다: ${e?.message ?? e}`);
  }
}

/** stdin 을 읽어 파싱한다. 파이프가 없으면 빈 객체다. */
export function readCliInput() {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { raw = ""; }
  return parseCliInput(raw);
}

/**
 * 검사기 CLI 본문을 감싼다. 오류는 **사유만** stderr 로 내고 1 로 끝난다.
 * 그냥 던지면 스택트레이스에 사유가 묻혀 CLI 로 쓸 수 없다.
 * 사용자 입력 오류(깨진 JSON · 알 수 없는 장르)는 버그가 아니라 잘못된 호출이므로
 * 스택이 필요 없다. 스택이 필요하면 NEREUS_DEBUG=1 로 본다.
 *
 * **성공 경로에서 process.exit(0) 을 부르지 않는다.** 파이프로 나가는 stdout 쓰기는
 * 비동기로 끝나므로, 쓰기 완료 전에 exit 하면 출력이 파이프 버퍼(64KiB)에서 잘린다.
 * 측정으로 확인했다(2026-09-13). 조용한 데이터 손실이고, exit(0) 은 애초에 불필요하다 —
 * 본문이 끝나면 프로세스는 0 으로 끝난다.
 */
export function runCli(body) {
  try {
    body();
  } catch (e) {
    if (process.env.NEREUS_DEBUG) throw e;
    process.stderr.write(`${e?.message ?? e}\n`);
    process.exit(1);
  }
}
