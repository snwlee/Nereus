// 영상 스타일 동반 도구 정책 — 라이선스·상표·유료 키로 판정한다. 순수 함수.
// 근거: docs/research/2026-10-30-video-style-skills.md (2026-10-30 확인)
export const COMPANIONS = Object.freeze({
  "lemo-opuscar": { repo: "https://github.com/lemomo-ai/lemo-opuscar", license: "MIT (데모 영상 CC BY 4.0)" },
  "collage-broll": { repo: "https://github.com/pyang5166/gbro-collage-broll", license: "MIT · Gemini 유료 영상 생성" },
  "claude-animation-base": { repo: "https://github.com/JohnHeibel/ClaudeAnimationBase", license: "MIT · Clawd 캐릭터는 Anthropic 상표" },
  onetake: { repo: "https://github.com/feitangyuan/onetake", license: "PolyForm Noncommercial 1.0.0 (상업은 onetake Pro)" },
});

const ALIASES = Object.freeze({ "collage-b-roll": "collage-broll", "gbro-collage-broll": "collage-broll", "lemo": "lemo-opuscar", cab: "claude-animation-base" });

const normalize = (name) => {
  const n = String(name ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return ALIASES[n] ?? n;
};

const v = (verdict, reason) => ({ verdict, reason });

export function companionVerdict(name, { commercial = false, named = false, paidKey = false } = {}) {
  switch (normalize(name)) {
    case "lemo-opuscar":
      return v("allow", "MIT, 키 불필요 — 라이브러리로만 clone 한다(플러그인 설치 금지: 트리거 충돌)");
    case "collage-broll":
      return paidKey
        ? v("conditional", "Gemini 유료 영상 생성 — video-gate·budget 승인 후, 정지 이미지는 nereus:image 로")
        : v("block", "Gemini 유료 키가 필요하다 — 사용자가 직접 넣어야 한다");
    case "claude-animation-base":
      return commercial
        ? v("block", "Clawd(Anthropic 마스코트) 상표 — 광고·상업 금지")
        : v("conditional", "비상업만, Clawd 를 자체 캐릭터로 바꿔 엔진·가이드만 참고");
    case "onetake":
      if (commercial) return v("block", "PolyForm Noncommercial — 상업은 회사 명의 onetake Pro 구매 후 재판정");
      return named
        ? v("conditional", "비상업 영상, 사용자가 지명했을 때만 — 전역 설치 시 promo 요청을 가로챈다")
        : v("block", "사용자가 지명하지 않았다 — 기본 문법을 HyperFrames 에서 빼앗는다");
    default:
      return v("block", `알 수 없는 동반 도구: ${name} — 조사 후 정책에 추가한다`);
  }
}
