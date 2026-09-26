// 브리프 → 통화 잡. 순수 함수.
//
// 실패 사례(2026-09-25 Japan2026): 지시문을 잡마다 손으로 복사했다. "AI 라고 먼저 밝힌다 · 사실만 · 확정 금지 ·
// 복창 · end_call" 중 하나만 빠져도 AI 가 사람인 척하거나 예약을 확정할 수 있다. 그래서 규칙은 여기 고정하고
// 브리프는 사실·질문만 넘긴다. 규칙 문구는 Japan2026/tools/aicall/jobs/*.json 의 Rules 를 옮긴 것이다.

import { DEFAULT_HOURS, DISCLOSURE_TAG, MAX_CALL_SEC } from "./judge.mjs";

export { DISCLOSURE_TAG };

const LANGS = Object.freeze({
  ja: {
    speak: "Speak Japanese (polite keigo) the whole time.",
    open: (b) => `お忙しいところ恐れ入ります。こちらはAIアシスタントでございます。${b.onBehalfOf}様の代わりに、お伺いしたいことがありお電話いたしました。`,
  },
  ko: {
    speak: "Speak Korean (polite 존댓말) the whole time.",
    open: (b) => `안녕하세요, 저는 AI 어시스턴트입니다. ${b.onBehalfOf} 님을 대신해 여쭤보려고 전화드렸습니다.`,
  },
  en: {
    speak: "Speak English the whole time.",
    open: (b) => `Hello, this is an AI assistant calling on behalf of ${b.onBehalfOf}.`,
  },
});

const RULES = [
  "You are an AI assistant calling on behalf of the person named above. Your very first sentence must say you are an AI assistant calling on their behalf. Never pretend to be human; if asked, say you are an AI.",
  "Use only the facts listed. Never invent names, numbers, dates or details.",
  "Ask the questions one at a time and wait for each answer.",
  "If asked something not in the facts, say you don't have that information and the person will contact them directly.",
  "Be polite and concise. Speak slowly and clearly. If you did not understand, ask them to repeat.",
  "At the end, briefly repeat back what you understood for each question, thank them, say goodbye, then call end_call.",
  "If you reach voicemail or an automated menu you cannot pass, say one short sentence of apology and call end_call.",
];

const NO_COMMIT = "Only ask questions and listen. Do not make, change or cancel any reservation, do not agree to any charge, never give card or payment details. If the staff offers to do anything binding, politely say the person will contact them directly.";

const commitRule = (items) =>
  `You may do only these binding actions, exactly as written, and nothing else: ${items.map((x) => `「${x}」`).join(" ")}. Never give card or payment details. For anything else binding, say the person will contact them directly.`;

function requireText(brief, key) {
  if (!String(brief?.[key] || "").trim()) throw new Error(`brief.${key} 가 비었다`);
}

export function buildJob(brief) {
  for (const key of ["to", "target", "onBehalfOf"]) requireText(brief, key);
  const lang = LANGS[brief.language];
  if (!lang) throw new Error(`지원하지 않는 언어: ${brief.language} (ja·ko·en)`);
  const questions = (brief.questions || []).filter((q) => String(q).trim());
  if (!questions.length) throw new Error("brief.questions 가 비었다");

  const facts = (brief.facts || []).map((f) => `- ${f}`);
  const mayCommit = (brief.mayCommit || []).filter((x) => String(x).trim());
  const instructions = [
    `${DISCLOSURE_TAG} You are calling ${brief.target}. ${lang.speak}`,
    `Open with: 「${lang.open(brief)}」`,
    "",
    "Facts (use only these; never invent anything else):",
    `- You are calling on behalf of: ${brief.onBehalfOf}`,
    ...facts,
    "Questions to ask, one at a time, and wait for each answer:",
    ...questions.map((q, i) => ` ${i + 1}. ${q}`),
    "Rules:",
    ...[...RULES.slice(0, 1), mayCommit.length ? commitRule(mayCommit) : NO_COMMIT, ...RULES.slice(1)].map((r) => `- ${r}`),
  ].join("\n");

  return {
    to: brief.to,
    language: brief.language,
    instructions,
    timeLimitSec: Math.min(brief.timeLimitSec || MAX_CALL_SEC, MAX_CALL_SEC),
    hours: brief.hours || DEFAULT_HOURS,
  };
}
