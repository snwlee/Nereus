#!/usr/bin/env bash
# 모든 플러그인 스킬(plugins/*/skills/*/)을 하나씩 skillspector 로 스캔하고 scan-gate.mjs 로 판정한다.
# CI skill-quality 잡과 로컬이 같은 스크립트를 쓴다. 판정 기준은 README.md.
#
# 사용: .github/skillspector/scan-all.sh [보고서 디렉터리]
#   종료 코드 0 = 통과, 1 = 새 CRITICAL/HIGH·스캔 실패·위험도 HIGH 이상.
# baseline: .github/skillspector/baselines/<플러그인>/<스킬>.yaml (있으면 적용)
set -uo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
out="${1:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/skillspector}"
mkdir -p "$out"
gate="plugins/nereus/skills/skill-audit/scripts/scan-gate.mjs"

# GitHub Actions 에서는 annotation, 로컬에서는 평문으로 찍는다.
note() { # note <error|warning> <메시지>
  if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::$1::$2"; else echo "[$1] $2"; fi
}

fail=0
count=0
shopt -s nullglob
for s in plugins/*/skills/*/; do
  plugin=$(basename "$(dirname "$(dirname "$s")")")
  name=$(basename "$s")
  id="$plugin/$name"
  if [ ! -f "$s/SKILL.md" ]; then
    note warning "$id: SKILL.md 가 없어 스킬로 보지 않고 건너뛴다"
    continue
  fi
  count=$((count + 1))
  mkdir -p "$out/$plugin"
  report="$out/$plugin/$name.json"
  baseline=".github/skillspector/baselines/$plugin/$name.yaml"
  args=(scan "$s" --no-llm --format json --output "$report")
  [ -f "$baseline" ] && args+=(--baseline "$baseline")
  if ! skillspector "${args[@]}" > /dev/null; then
    note error "$id: skillspector 가 실패했거나 위험도 HIGH 이상을 냈다"
    fail=1
  fi
  if ! verdict=$(node "$gate" "$report"); then
    note error "$id: 새 CRITICAL/HIGH 지적"
    echo "$verdict" | jq '.blocking'
    fail=1
  fi
  warn=$(echo "$verdict" | jq '[.warnings[] | select(.severity != "info")] | length')
  if [ "$warn" != "0" ]; then
    note warning "$id: 새 MEDIUM/LOW 지적 ${warn}건 — 검토 후 고치거나 baseline 에 사유와 함께 추가"
    echo "$verdict" | jq '[.warnings[] | select(.severity != "info") | {id, severity, pattern, location}]'
  fi
done

echo "스캔한 스킬: ${count}개, 결과: $([ "$fail" = 0 ] && echo 통과 || echo 실패)"
[ "$count" -gt 0 ] || { note error "스캔할 스킬을 하나도 찾지 못했다"; exit 1; }
exit "$fail"
