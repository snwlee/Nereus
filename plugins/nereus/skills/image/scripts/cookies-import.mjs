// 브라우저 확장이 내보낸 쿠키를 gemini_cli.py 가 읽는 형식으로 바꾼다.
//
// 왜 필요한가: Chrome 127+ 의 App-Bound Encryption 은 쿠키 키를 SYSTEM 권한 Elevation Service 가
// 들고 서명된 chrome.exe 만 복호화하게 한다. 그래서 chrome_cookies.py(macOS Keychain 방식)를
// Windows 로 옮길 길이 없다. 브라우저 확장은 브라우저 안에서 chrome.cookies API 를 쓰므로
// App-Bound 와 무관하고 HTTPOnly 쿠키도 읽는다 — Windows 에서 남은 유일한 정당한 경로다.
//
// 확장 설치 자체는 자동화할 수 없다(웹스토어 확장은 CLI 설치 불가). 설치는 setup 이 안내하고,
// 이 스크립트가 "Export 한 뒤" 를 자동화한다.
//
// 사용:
//   node cookies-import.mjs <export 파일>      Cookie-Editor JSON 또는 Netscape cookies.txt
//   pbpaste | node cookies-import.mjs -        클립보드에서 바로 (확장 Export 는 클립보드에 복사한다)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { userConfigDir } from "../../../hooks/scripts/lib/paths.mjs";

export const WANTED = Object.freeze(["__Secure-1PSID", "__Secure-1PSIDTS"]);

// 값 모양 검증. 잘린 붙여넣기가 가장 흔한 실패이고, 그때 서버는 조용히 거절만 한다.
const SHAPE = Object.freeze({
  "__Secure-1PSID": { prefix: "g.", why: '값이 "g." 로 시작해야 합니다 (잘린 붙여넣기일 수 있습니다)' },
  "__Secure-1PSIDTS": { prefix: "sidts-", why: '값이 "sidts-" 로 시작해야 합니다 (잘린 붙여넣기일 수 있습니다)' },
});

/** Netscape cookies.txt — domain, flag, path, secure, expiry, name, value 7열 탭 구분. */
export function parseNetscape(text) {
  const out = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim()) continue;
    // curl·yt-dlp 는 HTTPOnly 쿠키에 "#HttpOnly_" 접두를 붙인다. 주석이 아니라 데이터다.
    const httpOnly = line.startsWith("#HttpOnly_");
    if (line.startsWith("#") && !httpOnly) continue;
    const cols = (httpOnly ? line.slice("#HttpOnly_".length) : line).split("\t");
    if (cols.length < 7) continue;
    const name = cols[5].trim();
    if (!name) continue;
    out.push({ domain: cols[0].trim(), name, value: cols.slice(6).join("\t").trim() });
  }
  return out;
}

/** Cookie-Editor 등의 JSON. 객체 배열이 표준이고, 우리 쿠키 파일 모양({name: value})도 받는다. */
export function parseCookieJson(text) {
  let data;
  try {
    data = JSON.parse(String(text ?? ""));
  } catch {
    return null;
  }
  if (Array.isArray(data)) {
    return data
      .filter((c) => c && typeof c.name === "string")
      .map((c) => ({ domain: String(c.domain ?? ""), name: c.name, value: String(c.value ?? "") }));
  }
  if (data && typeof data === "object") {
    return Object.entries(data)
      .filter(([, v]) => typeof v === "string")
      .map(([name, value]) => ({ domain: "", name, value }));
  }
  return null;
}

/** 확장자를 믿지 않고 내용으로 포맷을 정한다 — 사용자가 .txt 로 저장한 JSON 이 흔하다. */
export function parseExport(text) {
  return parseCookieJson(text) ?? parseNetscape(text);
}

export function pickGeminiCookies(list) {
  const cookies = {};
  const invalid = [];
  for (const c of list ?? []) {
    if (!WANTED.includes(c.name)) continue;
    const shape = SHAPE[c.name];
    const value = String(c.value ?? "").trim();
    if (!value.startsWith(shape.prefix)) {
      // 같은 쿠키가 여러 번 나오면 마지막 유효값이 이긴다. 무효값 보고는 한 번만 남긴다.
      if (!invalid.some((i) => i.name === c.name)) invalid.push({ name: c.name, why: shape.why });
      continue;
    }
    cookies[c.name] = value;
  }
  // 유효값을 나중에 찾았다면 무효 보고를 지운다 — 중복 항목의 첫 값만 깨진 경우가 있다.
  const kept = invalid.filter((i) => !cookies[i.name]);
  const missing = WANTED.filter((n) => !cookies[n] && !kept.some((i) => i.name === n));
  return { ok: WANTED.every((n) => !!cookies[n]), cookies, missing, invalid: kept };
}

export function outputPath({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  if (env.GEMINI_WEB_COOKIES) return env.GEMINI_WEB_COOKIES;
  // gemini_cli.py 와 같은 위치여야 한다. 경로 규칙은 paths.mjs 한 곳에만 둔다.
  return path.join(userConfigDir({ env, platform, home }), "secrets", "gemini-web-cookies.json");
}

/** 값은 절대 찍지 않는다 — 이 파일은 시크릿이다. 이름과 길이만 보고한다. */
export function formatSummary(result, out) {
  if (result.ok) {
    const names = WANTED.map((n) => `${n}(${result.cookies[n].length}자)`).join(", ");
    return [
      `쿠키를 저장했습니다: ${out}`,
      `  ${names}`,
      "",
      "이제 gemini_cli.py 가 web 백엔드를 씁니다. 세션이 죽으면(SESSION DEAD) 확장에서 다시 Export 하세요 —",
      "Chrome 이 __Secure-1PSIDTS 를 주기적으로 회전시키므로 재추출이 필요합니다.",
    ].join("\n");
  }
  const lines = ["쿠키를 저장하지 않았습니다. Export 가 불완전합니다."];
  for (const n of result.missing) lines.push(`  없음: ${n}`);
  for (const i of result.invalid) lines.push(`  깨짐: ${i.name} — ${i.why}`);
  lines.push(
    "",
    "확인할 것:",
    "  1. gemini.google.com 에 로그인된 탭에서 Export 했는가 (google.com 도메인 쿠키가 필요합니다)",
    "  2. 확장이 HTTPOnly 쿠키를 포함했는가 (Cookie-Editor·Get cookies.txt LOCALLY 는 포함합니다)",
    "  3. 값이 잘리지 않았는가 (__Secure-1PSID 는 수백 자입니다)",
  );
  return lines.join("\n");
}

function readInput(arg) {
  if (!arg || arg === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(arg, "utf8");
}

function main(argv) {
  const args = argv.filter((a) => a !== "--quiet");
  let text;
  try {
    text = readInput(args[0]);
  } catch (e) {
    process.stderr.write(`입력을 읽을 수 없습니다: ${e.message}\n`);
    return 2;
  }
  if (!text.trim()) {
    process.stderr.write("입력이 비어 있습니다. 확장에서 Export 한 JSON 또는 cookies.txt 를 넘기세요.\n");
    return 2;
  }

  const result = pickGeminiCookies(parseExport(text));
  const out = outputPath();
  if (!result.ok) {
    process.stderr.write(formatSummary(result, out) + "\n");
    return 3;
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result.cookies, null, 2) + "\n", { mode: 0o600 });
  try {
    fs.chmodSync(out, 0o600); // 이미 있던 파일은 mode 옵션이 적용되지 않는다
  } catch { /* Windows 는 무시 */ }
  process.stdout.write(formatSummary(result, out) + "\n");
  return 0;
}

if (process.argv[1] && /cookies-import\.mjs$/.test(process.argv[1])) process.exit(main(process.argv.slice(2)));
