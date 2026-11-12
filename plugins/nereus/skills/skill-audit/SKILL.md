---
name: skill-audit
description: "Check skills for quality, security, duplication and actual usefulness. Use after adding or editing a skill, before installing an external one, or when always-on token cost grows. 트리거: \"스킬 점검\", \"스킬 감사\", \"이 스킬 안전해?\", \"스킬이 실제로 쓰이나\"."
---

# skill-audit — 스킬이 안전하고, 겹치지 않고, 실제로 쓰이는가

네 가지를 서로 다른 도구가 본다. 필요한 것만 골라 돌린다.

| 묻는 것 | 도구 | 키·Docker |
|---|---|---|
| 형식이 맞고 위험 패턴이 없나 | SkillEvaluator Tier 1 | 불필요 |
| 외부 스킬이 안전한가 | SkillSpector | 불필요 |
| 스킬끼리 겹치지 않나, 토큰을 낭비하지 않나 | SkillEvaluator Tier 2 | 임베딩 제공자 필요 |
| 스킬이 실제로 발동하고 도움이 되나 | `claude plugin eval` | 얼리 액세스 |

## 1. 형식·보안 (키 없이, 항상 가능)

**플러그인 전체를 한 번에** 본다(SkillEvaluator 0.8+). frontmatter 스키마·보안·PII·라이선스·코드 무결성·유니코드를 한 번에 검사한다. 2분 30초쯤 걸린다(nereus, 2026-11-12).
```bash
uv tool upgrade skillevaluator || uv tool install git+https://github.com/NVIDIA/SkillEvaluator.git   # 0.8 미만이면 올린다
PYTHONUTF8=1 skillevaluator validate "${CLAUDE_PLUGIN_ROOT}" --type plugin --tiers 1 --no-llm -o "$(pwd)/.nereus/skilleval"
```
- **Windows 한글(cp949) 콘솔은 `PYTHONUTF8=1` 이 없으면 결과 출력 중 `UnicodeEncodeError` 로 죽는다.** 분석은 끝났어도 보고서가 안 남는다.
- `-o` 는 절대 경로로 준다. `..` 이 들어간 상대 경로는 "parent traversal" 로 거부된다.
- gitleaks·bandit·skillspector 가 없으면 security·code-integrity 가 "didn't run" 으로 남는다. 그건 통과가 아니다 — 사용자에게 그렇게 알린다.
- frontmatter 오류는 대개 따옴표 없는 description 안의 `트리거: ` 다. YAML 은 값 안의 `: ` 를 새 키로 읽는다. Claude Code 는 관대하게 읽지만 엄격한 도구(SkillEvaluator·`npx skills`·다른 에이전트)는 거부한다 → description 을 큰따옴표로 감싼다.

0.8 미만이거나 스킬 하나만 볼 때는 스킬별로 돈다:
```bash
for s in "${CLAUDE_PLUGIN_ROOT}"/skills/*/; do
  skillevaluator validate "$s"
  skillevaluator quality-check "$s"
  skillevaluator security-scan "$s"
  skillevaluator lint-scripts "$s"
  skillevaluator pii-scan "$s"
done
```
`validate`는 frontmatter와 구조, `quality-check`는 description이 트리거로 쓸 만한지, `lint-scripts`는 스킬이 끼고 있는 스크립트, `pii-scan`은 개인정보 유출을 본다. 전부 결정론적이라 API 키가 없어도 돈다.

## 2. 외부 스킬 설치 전 (필수)

```bash
uv tool install git+https://github.com/NVIDIA/skillspector.git      # 최초 1회
skillspector scan <저장소 URL | 디렉터리 | zip> --no-llm --format json --output .nereus/skillspector.json
node "${CLAUDE_PLUGIN_ROOT}/skills/skill-audit/scripts/scan-gate.mjs" .nereus/skillspector.json   # 종료 코드 0 설치 가능, 1 차단
```
설치 전에 반드시 돌린다. 프롬프트 인젝션, 은닉 명령, 위험한 스크립트를 찾는다. 심각한 지적이 하나라도 있으면 설치하지 말고 사용자에게 근거와 함께 보고한다. 이미 검토한 지적은 baseline으로 억제해 재스캔에서 새 항목만 보이게 한다.

설치 게이트: 위 보고서를 `scan-gate.mjs`(`scanGate(report)`)로 판정한다. 설치 여부의 유일 진실원천은 그 반환값이다.
- critical/high 가 하나라도 있으면 차단(`install: false`), 그 외는 경고로 통과.
- `execution_successful: false`·빈 보고서·형식 깨짐은 fail-closed(차단).
- `analysis_completeness.is_complete: false` 는 통과시키되 `incomplete: true` 로 알린다 — 참조 하나 못 푼 것으로도 partial 이 나와서, 막으면 모든 설치가 막힌다.
- `--json` 옵션은 없다(2.11). 예전 문서대로 돌리면 `No such option` 으로 끝난다.

**차단됐다고 바로 버리지 않는다 — 지적을 읽고 사용자에게 보인다.** 정적 패턴 매칭이라 보안 문서·테스트 픽스처는 오탐이 많다.
cloudflare/security-audit-skill 은 HIGH 7건으로 `DO_NOT_INSTALL` 이었지만 전부 오탐이었다(공격 기법 설명의 "credentials.json"·"keychain", 경로 조작 테스트의 `/etc/passwd`).
지적마다 위치를 열어 "설명·예시인가, 실행되는 지시인가"를 적어 보이고, 설치는 사용자가 정한다.

버전을 올리면 baseline 을 다시 만든다 — 정확 지문 baseline 은 스캐너 버전에 묶여 업그레이드 뒤 아무것도 억제하지 않는다(2.12 CHANGELOG).

## 3. 중복·토큰 낭비 (임베딩 제공자 필요, 기본 비활성)

```bash
skillevaluator similarity-check "${CLAUDE_PLUGIN_ROOT}/skills"
skillevaluator context-optimization-check "${CLAUDE_PLUGIN_ROOT}/skills"
```
스킬이 늘수록 description이 서로 겹쳐 엉뚱한 스킬이 뜬다. `similarity-check`가 그 중복을, `context-optimization-check`가 상시 로드 토큰 낭비를 짚는다. 로컬 OpenAI 호환 엔드포인트로도 돌릴 수 있다. 키가 없으면 이 단계는 건너뛰고 그렇게 보고한다.

상시 토큰은 키 없이도 확인할 수 있다.
```bash
claude plugin details nereus@nereus     # Always-on 토큰과 컴포넌트별 비용
```

## 4. 실제로 발동하는가 (키 없이, 항상 가능)

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/skill-audit/scripts/coverage.mjs" [--limit 20] [--json]
```
이 프로젝트의 최근 세션 트랜스크립트를 읽어 **스킬이 한 번이라도 발동한 세션 비율**과 **한 번도 안 뜬 스킬**을 낸다. `Skill` 도구 호출과 슬래시 커맨드(`/nereus:build`) 둘 다 센다. 아무것도 업로드하지 않고 로컬 파일만 읽는다.

착안은 Warp의 [Skill Doctor](https://github.com/warpdotdev/common-skills)(MIT)의 `skill_coverage` 지표다. 진단 규칙도 같다. **설치돼 있는데 한 번도 안 걸렸다면 그건 스킬 내용이 아니라 description(트리거)의 문제다.**

## 5. 도움이 되는가 (얼리 액세스)

```bash
claude plugin eval nereus@nereus --ablation with-without --threshold 0.7
```
`tool_used: Skill` 채점자가 **스킬이 실제로 발동했는지**를 보고, ablation이 플러그인을 뺀 대조군과 점수를 비교해 **도움이 됐는지**를 낸다. 케이스는 `evals/`에 두고 `claude plugin eval init --bare <이름>`으로 틀을 만든다.

현재 이 기능은 얼리 액세스라 계정에 따라 `plugin eval is currently in early access`만 출력되고 끝난다. 그때는 대신 아래로 근사한다.
- `.nereus/learn/observations.jsonl`에 남은 도구 사용 기록으로 어떤 스킬이 실제로 쓰였는지 본다.
- 발동하지 않는 스킬은 description이 문제다. 사용자가 실제로 쓰는 표현을 description에 넣는다.

## 판단 기준
- **보안 지적**: 하나라도 있으면 차단. 외부 스킬이면 설치하지 않는다.
- **중복**: 두 스킬의 유사도가 높으면 하나로 합치거나 description에서 경계를 분명히 한다.
- **미발동**: 세 번 이상 써야 할 상황에서 안 떴으면 description을 고친다. 고쳐도 안 되면 스킬을 지운다. 안 쓰는 스킬은 상시 토큰만 먹는다.
- 지적을 조용히 무시하지 않는다. 무시할 이유가 있으면 그 이유를 사용자에게 말한다.
