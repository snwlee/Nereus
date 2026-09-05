// 완료 무결성 분류기. diff 텍스트만 보고 "끝났다"는 주장을 거부할 근거를 찾는다. 파일 실행 없음, 순수 함수.
// 카테고리: todo_marker, placeholder, skipped_test, stub, guard_removed
const DOC_EXT = /\.(md|mdx|txt|rst|adoc)$/i;
const TEST_FILE = /(^|\/)(test|tests|__tests__|spec)\/|(_test|Test|Tests|\.test|\.spec)\.[a-z]+$/;

const ADDED_RULES = [
  { category: "todo_marker", re: /\b(TODO|FIXME|XXX|HACK)\b/, message: "미완료 마커" },
  { category: "placeholder", re: /\b(TBD|PLACEHOLDER|lorem ipsum)\b|\?\?\?/i, message: "플레이스홀더" },
  { category: "skipped_test", re: /\b(it|test|describe)\.(skip|todo)\s*\(|\bx(it|test|describe)\s*\(|@Disabled|@Ignore\b|@pytest\.mark\.skip|\bskip\s*\(\s*['"]|\/\/\s*skip\b/, message: "건너뛴/비활성 테스트" },
  { category: "stub", re: /not implemented|NotImplementedError|UnsupportedOperationException|UnimplementedError|\bunimplemented!\(|\btodo!\(/i, message: "스텁 구현" },
];
const GUARD_RE = /^\s*(if\s*\(.*\)\s*(throw|return)|guard\s|assert\s*\(|require\s*\(|Objects\.requireNonNull|precondition)/;

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
    for (const line of f.added) {
      for (const r of ADDED_RULES) if (r.re.test(line)) findings.push({ category: r.category, file: f.file, line: line.trim().slice(0, 120), message: r.message });
    }
    if (!TEST_FILE.test(f.file) && !testTouched) {
      for (const line of f.removed) if (GUARD_RE.test(line)) findings.push({ category: "guard_removed", file: f.file, line: line.trim().slice(0, 120), message: "가드 제거인데 테스트 변경 없음 (부정 테스트를 추가하거나 이유를 기록)" });
    }
  }
  return { pass: findings.length === 0, findings };
}
