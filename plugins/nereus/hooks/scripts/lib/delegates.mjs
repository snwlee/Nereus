// 외부 스킬 위임 — 하네스 밖에 이미 있는 스킬로 보낸다.
//
// 마케팅 소재(광고 영상·프로모·모션그래픽)는 우리가 만들 것이 아니다. 전용 스킬이 이미 있고
// 각자 유지된다. 복사해두면 낡는다 — Unity 공식 플러그인에 엔진 절차를 위임한 것과 같은 자리다.
//
// **설치된 것만 라우트한다.** 없는 스킬을 부르라고 지목하면 죽은 지시가 되고,
// 라우터를 한 번 헛돌게 만들면 그 다음부터 라우터 자체가 무시된다.
//
// 이 스킬들은 마켓플레이스 플러그인이 아니라 **스킬 디렉터리**(`~/.claude/skills/<이름>`)에
// 놓는 종류다. 그래서 `companions`(플러그인 설치·업데이트 명령)와 다른 경로로 다룬다 —
// 설치 명령을 만들어낼 수 없으므로 있는 척하지 않고 위치만 알린다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 정규식은 **좁게** 잡는다. 코어 라우트(nereus:image·nereus:design·nereus:research)가
 * 이미 담당하는 말(배너·썸네일·아이콘·디자인·조사)을 가로채면 안 된다.
 * 코어가 항상 앞에 오지만, MAX_HITS 가 2 라 넓은 정규식은 두 번째 자리를 낭비한다.
 */
export const DELEGATES = Object.freeze([
  { skill: "ad-video", dir: "ad-video", why: "유료 소셜 광고 영상(릴스·쇼츠)", re: /(광고\s?(영상|비디오|소재\s?영상)|퍼포먼스\s?(영상|크리에이티브)|릴스\s?광고|ad\s?(video|creative))/i },
  { skill: "product-launch-video", dir: "product-launch-video", why: "제품 출시·프로모 영상", re: /(출시\s?영상|프로모\s?(영상|비디오)|런칭\s?영상|제품\s?소개\s?영상|promo\s?video)/i },
  { skill: "motion-graphics", dir: "motion-graphics", why: "짧은 모션그래픽·로고 스팅", re: /(모션\s?그래픽|로고\s?(스팅|애니메이션)|키네틱\s?타이포|lower.?third)/i },
  { skill: "hyperframes", dir: "hyperframes", why: "영상·애니메이션 전반의 진입점", re: /(영상(으로)?\s?(만들|제작|뽑)|비디오\s?(만들|제작)|애니메이션\s?(만들|제작)|영상\s?편집)/i },
]);

const skillDir = (home, dir) => path.join(home, ".claude", "skills", dir);
const defaultExists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

/** 각 위임 대상의 설치 여부와 놓일 위치. 없는 것도 행으로 남긴다 — 숨기면 설치할 수 있다는 사실이 사라진다. */
export function delegateStatus({ home = os.homedir(), exists = defaultExists } = {}) {
  return DELEGATES.map((d) => {
    const where = skillDir(home, d.dir);
    return { skill: d.skill, why: d.why, present: exists(where), where };
  });
}

/** 라우터에 넘길 추가 라우트. **설치된 것만** 낸다. */
export function delegateRoutes(opts = {}) {
  const present = new Set(delegateStatus(opts).filter((r) => r.present).map((r) => r.skill));
  return DELEGATES.filter((d) => present.has(d.skill)).map(({ skill, why, re }) => ({ skill, why, re }));
}

// 실행 진입점. 설치 여부 표를 JSON 으로 낸다(setup 이 부른다).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.stdout.write(JSON.stringify(delegateStatus(), null, 2) + "\n");
}
