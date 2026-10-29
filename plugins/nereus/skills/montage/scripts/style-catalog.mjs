// Lemo-Opuscar 스타일 카탈로그 — style.json 정규화와 브리프 겹침으로 후보 고르기. 순수 함수, LLM 호출 없음.
// 후보를 낼 뿐이다. 고른 스타일의 STYLE.md 를 읽고 장면 지시로 옮기는 것은 사람(또는 Claude)이 한다.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const DEFAULT_N = 5;
const MIN_TOKEN = 2;
const PLURAL_MIN = 4;

// 광고·상업 영상에서 빼는 스타일과 이유. 비상업이면 남기되 경고를 단다.
export const BLOCKED_STYLES = Object.freeze({
  "living-screencast": "Clawd (Anthropic 마스코트) 등장 — 상표, 광고 금지",
});

export function tokens(text) {
  const out = String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter((t) => t.length >= MIN_TOKEN)
    .map((t) => (t.length >= PLURAL_MIN && /[a-z]s$/.test(t) ? t.slice(0, -1) : t));
  return [...new Set(out)];
}

export function normalizeStyle(json) {
  const slug = String(json?.slug ?? "");
  if (!SLUG_RE.test(slug)) return null;
  return {
    slug,
    name: String(json.en ?? slug),
    category: String(json.category_en ?? ""),
    uses: Array.isArray(json.uses) ? json.uses.map(String) : [],
    film: String(json.film ?? ""),
    line: String(json.line ?? ""),
    dur: Number.isFinite(json.dur) ? json.dur : null,
  };
}

const styleTokens = (s) => new Set(tokens([...s.uses, s.name, s.category, s.line].join(" ")));

export function pickStyles(catalog, brief, { commercial = false, n = DEFAULT_N } = {}) {
  const want = tokens(brief);
  return catalog
    .filter((s) => !(commercial && BLOCKED_STYLES[s.slug]))
    .map((s) => {
      const have = styleTokens(s);
      const matched = want.filter((t) => have.has(t)).sort();
      const warning = BLOCKED_STYLES[s.slug];
      return { ...s, score: matched.length, matched, ...(warning ? { warning } : {}) };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, n);
}
