// tasks 파일 검사기. spec "태스크 규칙"을 기계로 강제한다. 파일 실행 없음, 순수 함수 + CLI.
// 사용: node lint-tasks.mjs <tasks파일>   종료코드 0=통과, 1=위반. 출력은 JSON.
// 검사: 태스크마다 Files/Interfaces/Steps/Done when 필수 + 플레이스홀더 금지
// (출처: superpowers writing-plans "No Placeholders"를 Nereus 태스크 형식에 맞춰 축소).
import fs from "node:fs";

const HEADER_RE = /^-\s*\[(?: |x)\]\s*(.+?)\s*$/;
const REQUIRED = ["Files:", "Interfaces:", "Steps:", "Done when:"];

// 뭉뚱그림·미기입 패턴. 태스크는 실행자가 그대로 옮기면 되게 exact해야 한다.
const ANGLE_RE = /<[^>\n]{1,30}>/;
const PLACEHOLDER_RES = [
  /\bTBD\b/i,
  ANGLE_RE,
  // 산문 말줄임만 잡는다. JS 스프레드(`{ ...base }`, `[...xs]`, `f(...args)`)는 정상 코드다.
  /\.\.\.(?![A-Za-z_$[{])/,
  /\b(TODO|FIXME)\b/,
  /(적절한|알맞은|필요한|충분한)\s*(에러 처리|검증|테스트|추가|구현|수정)/,
  /위\s*(항목|내용|코드|테스트).*(테스트|작성|확인)/,
  /(Task|태스크)\s*\d+.*(유사|동일|같이|같은|참고|처럼)/,
  /(나중에|추후에?)\s*(구현|작성|추가|처리|결정)/,
];

export function lintTasks(text) {
  const findings = [];
  let cur = null;
  let tasks = 0;
  const flush = () => {
    if (!cur) return;
    for (const req of REQUIRED) {
      if (!cur.block.includes(req)) findings.push({ task: cur.name, category: "missing_section", message: `필수 항목 누락: ${req}` });
    }
    for (const { text, fenced } of cur.lines) {
      for (const re of PLACEHOLDER_RES) {
        // 꺾쇠는 코드 블록 안에서 제네릭(`Array<string>`)이나 비교 연산이다. 자리표시자가 아니다.
        // 말줄임은 코드 안에서도 진짜 구멍이므로 그대로 잡는다.
        if (re === ANGLE_RE && fenced) continue;
        if (re.test(text)) findings.push({ task: cur.name, category: "placeholder", message: `플레이스홀더 의심(${re.source.slice(0, 40)}): ${text.trim().slice(0, 80)}` });
      }
    }
  };
  let inFence = false;   // 펜스 자체도 "안"으로 친다 — 언어 태그(```ts)에는 꺾쇠가 없다
  for (const raw of text.split("\n")) {
    const isFence = /^\s*```/.test(raw);
    if (isFence) inFence = !inFence;
    const m = raw.match(HEADER_RE);
    if (m && !/^\s/.test(raw) && !inFence) { flush(); tasks++; cur = { name: m[1].slice(0, 80), lines: [], block: "" }; continue; }
    if (cur) { cur.lines.push({ text: raw, fenced: inFence || isFence }); cur.block += raw + "\n"; }
  }
  flush();
  return { pass: findings.length === 0, tasks, findings };
}

if (process.argv[1] && /lint-tasks\.mjs$/.test(process.argv[1])) {
  const file = process.argv[2];
  if (!file) { process.stderr.write("사용: node lint-tasks.mjs <tasks파일>\n"); process.exit(2); }
  const r = lintTasks(fs.readFileSync(file, "utf8"));
  process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  process.exit(r.pass ? 0 : 1);
}
