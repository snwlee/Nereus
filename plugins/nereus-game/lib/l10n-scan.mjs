// 현지화 검사기. 번역을 실행하지 않고, 번역하면 깨질 곳을 지금 찾는다.
// 출시 후에 발견하면 고치는 비용이 몇 배가 된다.
import { expansionOf, localeIds } from "./locales.mjs";

// 사용자 노출로 볼 문자열: 한글·CJK 가 있거나, 두 글자 이상 단어 뒤에 공백이 오는 것.
// 식별자·경로·포맷 토큰을 사용자 문장으로 오인하지 않기 위한 최소 조건이다.
const USER_FACING = /[가-힣ぁ-んァ-ヶ一-龥]|[A-Za-z]{2,}\s/;
const LITERAL = /"([^"\n]{2,})"|'([^'\n]{2,})'/g;
const COMMENT = /^\s*(--|\/\/|#)/;

export function scanL10n({ locales, base = "", tables = {}, sources = [], maxWidth = 0, accessor = "L(" } = {}) {
  const known = new Set(localeIds(locales));
  for (const id of Object.keys(tables)) {
    // 조용히 건너뛰면 그 로케일이 검사되지 않은 채 통과한다. 던지는 편이 낫다.
    if (!known.has(id)) throw new Error(`알 수 없는 로케일: ${id} (있는 것: ${[...known].join(", ")})`);
  }
  const baseId = base || locales?.base;
  const violations = [];

  for (const src of sources) {
    const lines = String(src?.text ?? "").split("\n");
    lines.forEach((line, i) => {
      if (COMMENT.test(line) || line.includes(accessor)) return;
      for (const m of line.matchAll(LITERAL)) {
        const text = m[1] ?? m[2] ?? "";
        if (USER_FACING.test(text)) violations.push({ code: "hardcoded", file: src?.file ?? "", line: i + 1, text });
      }
    });
  }

  const baseTable = tables[baseId] ?? {};
  for (const id of Object.keys(tables)) {
    if (id === baseId) continue;
    for (const key of Object.keys(baseTable)) {
      if (!(key in tables[id])) violations.push({ code: "missing-key", locale: id, key });
    }
  }

  if (Number(maxWidth) > 0) {
    for (const id of Object.keys(tables)) {
      const rate = expansionOf(locales, id);
      for (const [key, value] of Object.entries(baseTable)) {
        const width = String(value).length * rate;
        if (width > Number(maxWidth)) {
          violations.push({ code: "overflow", locale: id, key, width: Math.round(width * 100) / 100, maxWidth: Number(maxWidth) });
        }
      }
    }
  }

  return { violations };
}
