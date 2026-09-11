// doctor 의 파일 I/O. 순수 판정(apply.mjs·doctor-ledger.mjs)과 실제 디스크 사이의 얇은 층이다.
//
// 두 규약을 여기서 지킨다.
// - 원장은 append-only. 기존 내용을 다시 쓰지 않는다 — 한 줄 덧붙이기만 한다.
//   깨진 줄은 그 줄만 버린다. 한 줄 때문에 원장 전체를 잃으면 ack 가 전부 풀려 다시 시끄러워진다.
// - 설정 파일은 원자적으로 쓴다. 임시 파일에 먼저 쓰고 성공했을 때만 rename 한다.
//   중간에 죽어도 사용자 settings.json 이 반쯤 쓰인 채로 남지 않는다.
//
// fs 는 전부 주입 가능하다. 테스트는 실제 홈 디렉터리를 건드리지 않는다.
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const JSON_INDENT = 2;

/** 한 줄을 파싱한다. 실패하면 null — 호출 측이 그 줄만 버린다. */
function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * JSONL 원장을 읽는다. 파일이 없거나 읽기 실패면 빈 배열, 빈 줄과 깨진 줄은 건너뛴다.
 * @param {{file: string, readText?: (file: string) => string}} o
 * @returns {object[]}
 */
export function readLedger({ file, readText = (f) => readFileSync(f, "utf8") }) {
  let text;
  try {
    text = readText(file);
  } catch {
    return [];
  }
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseLine)
    .filter((entry) => entry !== null);
}

/**
 * 원장에 한 줄을 덧붙인다. 부모 디렉터리를 먼저 만든다.
 * @param {{file: string, entry: object, appendText?: (file: string, text: string) => void, mkdir?: (dir: string) => void}} o
 */
export function appendLedger({
  file,
  entry,
  appendText = (f, s) => appendFileSync(f, s, "utf8"),
  mkdir = (d) => mkdirSync(d, { recursive: true }),
}) {
  mkdir(dirname(file));
  appendText(file, JSON.stringify(entry) + "\n");
}

/**
 * 설정을 원자적으로 쓴다. `file.<pid>.tmp` 에 먼저 쓰고 성공했을 때만 대상 위로 rename 한다.
 * 쓰기가 던지면 rename 하지 않고 그대로 던진다 — 대상 파일은 손대지 않은 채 남는다.
 * @param {{file: string, settings: object, writeText?: (file: string, text: string) => void, rename?: (from: string, to: string) => void}} o
 */
export function writeSettingsAtomic({
  file,
  settings,
  writeText = (f, s) => writeFileSync(f, s, "utf8"),
  rename = (from, to) => renameSync(from, to),
}) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeText(tmp, JSON.stringify(settings, null, JSON_INDENT) + "\n");
  rename(tmp, file);
}
