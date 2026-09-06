// 스킬 라우터. 프롬프트를 정규식으로만 보고 "이 요청은 어느 Nereus 스킬 대상인가"를 지목한다.
// 존재 이유: v0.5.1 에서 스킬 description 을 토큰 절약하려고 압축한 뒤, 모델이 알아서 스킬을
// 떠올리는 빈도가 떨어졌다. 상시 토큰을 다시 늘리는 대신 프롬프트마다 필요한 한 줄만 주입한다.
// LLM 호출 없음. 순수 함수.

// 프로세스 스킬(debug·intake)을 앞에 둔다 — 접근법을 먼저 정하고 구현 스킬이 그 뒤를 따른다.
export const ROUTES = Object.freeze([
  { skill: "nereus:debug", why: "버그·실패·예상과 다른 동작", re: /(버그|에러|오류|예외|실패|깨(졌|진|져)|터(졌|져)|크래시|스택\s?트레이스|디버그|디버깅|재현|안\s?(되|돼|됨|먹)|왜\s?(이러|안|그)|이상해|먹통|무한\s?루프|타임아웃|bug|crash|stack\s?trace|traceback|regression|flaky)/i },
  { skill: "nereus:intake", why: "새 기능·새 프로젝트 시작", re: /(개발해|구축해|처음부터|from\s?scratch|프로젝트\s?(시작|셋업)|착수|(새|신규)\s?(기능|프로젝트|서비스|앱|화면|시스템)|(기능|프로젝트|서비스|앱|시스템)\s?(을|를)?\s?(만들|추가해)|(새|신규)\s?\S{0,6}\s?만들)/i },
  { skill: "nereus:design", why: "디자인·UI·UX·미감", re: /(디자인|ui\b|ux\b|화면|레이아웃|스타일|테마|폰트|타이포|팔레트|색(상|깔)|여백|간격|컴포넌트|예쁘게|이쁘게|미감|보기\s?좋게|반응형|다크\s?모드|css|tailwind|figma)/i },
  { skill: "nereus:spec", why: "스펙·계획·태스크 분해", re: /(스펙|명세|요구사항|계획\s?(세워|짜)|설계해|태스크로|작업\s?쪼개|로드맵|spec\b|prd\b)/i },
  { skill: "nereus:build", why: "태스크 구현", re: /(구현해|이\s?태스크|다음\s?태스크|코드\s?(써|작성)|기능\s?추가|리팩터|리팩토링|implement)/i },
  { skill: "nereus:e2e", why: "사용자 흐름 E2E", re: /(e2e|엔드투엔드|end.to.end|사용자\s?흐름|플로우\s?테스트|playwright|patrol|시나리오\s?테스트)/i },
  { skill: "nereus:review", why: "코드 리뷰·검토", re: /(리뷰|코드\s?검토|검토해\s?줘|검토해$|점검해|review|보안\s?(점검|검토|리뷰))/i },
  { skill: "nereus:finish", why: "완료·커밋·마무리", re: /(마무리|끝내|완료\s?처리|커밋(하|해)|푸시(하|해)|정리해\s?줘|pr\s?(만들|올려)|배포\s?준비)/i },
  { skill: "nereus:research", why: "시장·기술 조사", re: /(조사(해|를)|리서치|비교(해|해줘)|시장\s?분석|경쟁(사|자)|research|벤치마킹)/i },
  { skill: "nereus:image", why: "이미지·아이콘 생성", re: /(이미지\s?(만들|생성)|아이콘|배너|썸네일|일러스트|목업\s?이미지|스토어\s?아트)/i },
  { skill: "nereus:pdf", why: "PDF·문서 산출", re: /(pdf|보고서로|문서로\s?(만들|뽑)|타이포스트|typst)/i },
  { skill: "nereus:seo", why: "검색 노출·메타", re: /(seo|검색\s?(노출|엔진)|메타\s?태그|사이트맵|lighthouse)/i },
  { skill: "nereus:handoff", why: "컨텍스트 인계", re: /(핸드오프|handoff|여기까지\s?(저장|정리)|인계|컨텍스트\s?(정리|저장))/i },
  { skill: "nereus:learn", why: "규칙으로 학습", re: /(다음부터|앞으로(는)?\s?이렇게|기억해\s?줘|규칙으로|학습\s?후보)/i },
]);

const MAX_HITS = 2;

// 경로·식별자 안의 단어는 요청이 아니다. `src/error/handler.ts` 로 debug 가 발화하면 안 된다.
const stripCode = (t) => String(t)
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/`[^`]*`/g, " ")
  .replace(/[\w./-]*[/\\][\w./\\-]*/g, " ")
  .replace(/\b[\w-]+\.(ts|tsx|js|mjs|jsx|dart|java|kt|py|go|rs|css|scss|html|json|md|yaml|yml)\b/gi, " ");

export function routePrompt(text, { seen = [] } = {}) {
  if (typeof text !== "string" || !text.trim()) return [];
  const body = stripCode(text);
  const hits = [];
  for (const r of ROUTES) {
    if (seen.includes(r.skill)) continue;
    if (r.re.test(body)) hits.push({ skill: r.skill, why: r.why });
    if (hits.length >= MAX_HITS) break;
  }
  return hits;
}

export function routerNotice(hits) {
  if (!hits?.length) return "";
  const list = hits.map((h) => `${h.skill}(${h.why})`).join(", ");
  return `[Nereus] 이 요청은 ${list} 대상입니다. 답하거나 파일을 열기 전에 Skill 로 먼저 불러 그 절차대로 진행하세요 — 기억으로 절차를 재현하지 않습니다. 맞지 않으면 한 줄로 이유를 말하고 넘어가면 됩니다.`;
}

export function skillMapBlock() {
  const rows = ROUTES.map((r) => `- ${r.skill} — ${r.why}`).join("\n");
  return [
    "## 스킬을 먼저 부른다",
    "요청이 아래 중 하나에 조금이라도 해당되면 **답하거나 코드를 읽기 전에** 그 스킬을 Skill 로 부른다.",
    "절차를 기억으로 재현하지 않는다. 프로세스 스킬(debug·intake)이 구현 스킬보다 먼저다.",
    rows,
  ].join("\n");
}
