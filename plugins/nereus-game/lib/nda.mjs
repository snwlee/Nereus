// NDA 구역 판정. **순수 함수다** — 훅·리뷰·스캔이 전부 이것 하나를 쓴다.
// 판정이 두 곳에 갈라져 있으면 한쪽만 막히고 다른 쪽으로 샌다.
//
// Nintendo SDK 는 NDA 강도가 가장 센 축이고, Nereus 의 review 는 코드를 외부 모델에 보낸다.
// 경계가 없으면 이 하네스로 Switch 개발을 할 수 없다.

export const NDA_ZONES = Object.freeze([
  "Platform/Switch/**",
  "**/NintendoSDK/**",
  "**/*.nx.*",
]);

const norm = (p) => String(p ?? "").replace(/\\/g, "/");

/**
 * 글롭을 정규식으로. `**` 는 경로 구분자를 넘고 `*` 는 넘지 않는다.
 *
 * 문자 단위 단일 패스로 만든다. 순차 replace 를 쓰면 앞선 치환이 만들어낸 `*`·`.` 를
 * 뒤 치환이 다시 건드려 정규식이 조용히 망가진다(이번에 실제로 물렸다).
 */
function globToRe(glob) {
  const g = norm(glob);
  let out = "";
  for (let i = 0; i < g.length; i += 1) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        i += 1;
        if (g[i + 1] === "/") { i += 1; out += "(?:[^/]+/)*"; } else { out += ".*"; }
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

export function isNdaPath(file, extraZones = []) {
  const p = norm(file);
  if (!p) return false;
  return [...NDA_ZONES, ...extraZones].some((z) => globToRe(z).test(p));
}

/** 명령 문자열에서 NDA 경로로 보이는 토큰만 뽑는다. 원본 표기를 그대로 돌려준다. */
export function ndaPathsIn(text, extraZones = []) {
  return String(text ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => isNdaPath(tok, extraZones));
}
