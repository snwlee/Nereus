// 완료 무결성 분류기. diff 텍스트만 보고 "끝났다"는 주장을 거부할 근거를 찾는다. 파일 실행 없음, 순수 함수.
// 카테고리: todo_marker, placeholder, skipped_test, stub, guard_removed, silent_failure
// silent_failure 출처: ecc silent-failure-hunter 를 diff 휴리스틱으로 축소 이식 (빈 catch·삼킴 fallback·except-pass).
const DOC_EXT = /\.(md|mdx|txt|rst|adoc)$/i;
const TEST_FILE = /(^|\/)(test|tests|__tests__|spec)\/|(_test|Test|Tests|\.test|\.spec)\.[a-z]+$/;

const ADDED_RULES = [
  { category: "todo_marker", re: /\b(TODO|FIXME|XXX|HACK)\b/, message: "미완료 마커" },
  { category: "placeholder", re: /\b(TBD|PLACEHOLDER|lorem ipsum)\b|\?\?\?/i, message: "플레이스홀더" },
  { category: "skipped_test", re: /\b(it|test|describe)\.(skip|todo)\s*\(|\bx(it|test|describe)\s*\(|@Disabled|@Ignore\b|@pytest\.mark\.skip|\bskip\s*\(\s*['"]|\/\/\s*skip\b/, message: "건너뛴/비활성 테스트" },
  { category: "stub", re: /not implemented|NotImplementedError|UnsupportedOperationException|UnimplementedError|\bunimplemented!\(|\btodo!\(/i, message: "스텁 구현" },
];
const GUARD_RE = /^\s*(if\s*\(.*\)\s*(throw|return)|guard\s|assert\s*\(|require\s*\(|Objects\.requireNonNull|precondition)/;

// 조용한 실패: 한 줄에 다 드러나는 패턴.
const SILENT_RE = [
  /\bcatch\s*\([^)]*\)\s*\{\s*\}/, // catch (e) {}
  /\.catch\(\s*\(\s*\)\s*=>\s*(\[\]|\{\}|null|undefined)\s*\)/, // .catch(() => [])
  /\.catch\(\s*\([^)]*\)\s*=>\s*\{\s*\}\s*\)/, // .catch((e) => {})
  /\bexcept\b[^:]*:\s*pass\b/, // except ...: pass
];
// 두 줄에 걸친 패턴: 여는 줄 다음 줄이 바로 닫힘/pass면 본문이 없다.
const SILENT_OPEN_RE = [
  /\bcatch\s*(\([^)]*\))?\s*\{\s*$/,
  /\bexcept\b[^:]*:\s*$/,
];
const SILENT_CLOSE_RE = [/^\s*\}\s*$/, /^\s*pass\s*$/];
const silentPair = (prev, cur) =>
  SILENT_OPEN_RE.some((re) => re.test(prev)) && SILENT_CLOSE_RE.some((re) => re.test(cur));

export function parseDiff(text) {
  const files = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (m) { cur = { file: m[2], added: [], removed: [] }; files.push(cur); continue; }
    if (!cur || line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) cur.added.push(line.slice(1));
    else if (line.startsWith("-")) cur.removed.push(line.slice(1));
  }
  return files;
}

export function checkIntegrity(diffText) {
  const files = parseDiff(diffText);
  const findings = [];
  const testTouched = files.some((f) => TEST_FILE.test(f.file));
  for (const f of files) {
    if (DOC_EXT.test(f.file)) continue;
    for (let i = 0; i < f.added.length; i++) {
      const line = f.added[i];
      for (const r of ADDED_RULES) if (r.re.test(line)) findings.push({ category: r.category, file: f.file, line: line.trim().slice(0, 120), message: r.message });
      if (SILENT_RE.some((re) => re.test(line)) || (i > 0 && silentPair(f.added[i - 1], line)))
        findings.push({ category: "silent_failure", file: f.file, line: line.trim().slice(0, 120), message: "조용한 실패 (에러를 삼킴 — 로그·재전파·복구 중 하나를 추가)" });
    }
    if (!TEST_FILE.test(f.file) && !testTouched) {
      for (const line of f.removed) if (GUARD_RE.test(line)) findings.push({ category: "guard_removed", file: f.file, line: line.trim().slice(0, 120), message: "가드 제거인데 테스트 변경 없음 (부정 테스트를 추가하거나 이유를 기록)" });
    }
  }
  return { pass: findings.length === 0, findings };
}
