---
name: skill-audit
description: 스킬 품질·보안·중복·실효성을 점검한다. 스킬을 추가·수정한 뒤, 외부 스킬을 설치하기 전, 상시 토큰이 늘었을 때 사용. "스킬 점검", "스킬 감사", "이 스킬 안전해?", "스킬이 실제로 쓰이나" 요청 시.
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

```bash
uv tool install git+https://github.com/NVIDIA/SkillEvaluator.git   # 최초 1회
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
skillspector scan <저장소 URL | 디렉터리 | zip> --json
```
설치 전에 반드시 돌린다. 프롬프트 인젝션, 은닉 명령, 위험한 스크립트를 찾는다. 심각한 지적이 하나라도 있으면 설치하지 말고 사용자에게 근거와 함께 보고한다. 이미 검토한 지적은 baseline으로 억제해 재스캔에서 새 항목만 보이게 한다.

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

## 4. 실제로 발동하고 도움이 되는가

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
