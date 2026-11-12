// 모델 별칭의 기준 표. 배정 근거: openspec/changes/2026-11-13-agent-model-tiers/proposal.md "배정 근거"
// 별칭 해석은 Claude Code 에 맡긴다(code.claude.com/docs/en/model-config). 버전 고정은 ANTHROPIC_DEFAULT_*_MODEL 의 일이다.
// 에이전트가 맡겨질 때 쓰이는 값은 agents/*.md frontmatter 다(code.claude.com/docs/en/sub-agents)
// — tests/skills/agent-models.test.ts 가 이 표와 대조한다.
const t = (model, effort = "medium") => Object.freeze({ model, effort });

export const AGENT_TIERS = Object.freeze({
  "nereus/architect": t("opus"),
  "nereus/security": t("opus", "high"),
  "nereus-game/gameplay-engineer": t("opus"),
  "nereus/app": t("sonnet"),
  "nereus/backend": t("sonnet"),
  "nereus/frontend": t("sonnet"),
  "nereus/qa": t("sonnet"),
  "nereus/researcher": t("sonnet"),
  "nereus/reviewer": t("sonnet"),
  "nereus/seo": t("sonnet"),
  "nereus/writer": t("sonnet"),
  "nereus-game/art-director": t("sonnet"),
  "nereus-game/economy-designer": t("sonnet"),
  "nereus-game/game-ux": t("sonnet"),
  "nereus-game/level-designer": t("sonnet"),
  "nereus-game/narrative-writer": t("sonnet"),
  "nereus-3d/graphics-engineer": t("sonnet"),
  "nereus-ads/ads-engineer": t("sonnet"),
  "nereus-l10n/l10n-engineer": t("sonnet"),
});

// 서브에이전트 호출 지점(review EGM·반박, goldfish 리뷰어)과 세션 권고.
// 정본: openspec 스펙 spec-tool-selection 의 요구 id plan.modelTiers.
const MID = Object.freeze({ reviewer: "sonnet", refuter: "opus", session: null });
const BY_SIZE = Object.freeze({
  small: MID,
  medium: MID,
  large: Object.freeze({ reviewer: "opus", refuter: "opus", session: "fable" }),
});

// 모르는 규모는 medium 으로 보되 호출자가 알릴 수 있게 assumed 를 세운다.
// 객체 키("constructor" 등)·문자열이 아닌 값도 모르는 값이다.
export const resolveSize = (size) =>
  typeof size === "string" && Object.hasOwn(BY_SIZE, size) ? { size, assumed: false } : { size: "medium", assumed: true };
export const modelsFor = (size) => BY_SIZE[resolveSize(size).size];
