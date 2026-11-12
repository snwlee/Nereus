# security 판정 규칙과 반증 검증 (security-audit-rules)

## Problem

nereus `security` 에이전트는 OWASP 체크리스트 20줄뿐이다. 심각도 기준이 없어 같은 종류의 지적이 리뷰마다 HIGH·MEDIUM 을 오간다.
"심층 방어 한 겹 부재"·"모범 사례 위반" 같은 지적이 HIGH 로 나와 수정 루프를 돌린다. 배포 설정에 달린 사실을 추측해 판정한다.

## Goals

cloudflare/security-audit-skill(MIT, commit c1c8a8c)에서 판정 규칙만 옮긴다.
- 경계+결과 요건: 낮은 신뢰의 주체 → 입력 → 통제 → 넘은 경계 → 영향 → 결과를 못 대면 강화 권고(LOW).
- 심각도 기준표(critical/high/medium/low)와 high·medium 구분 질문.
- `needs_validation`: 저장소 밖 사실이 판정을 가르면 심각도 없이 빠진 사실을 적고 ledger 로.
- 반증 검증: security 의 CRITICAL/HIGH 는 새 맥락 서브에이전트(`security_refuter` 페르소나)가 반박해 본다. 살아남은 것만 차단.
- 도메인 참고 두 개(AI·LLM, 공급망·릴리스)를 원문 그대로 싣는다.
- skill-audit 의 SkillSpector·SkillEvaluator 연동을 실제 CLI 에 맞춘다(실측으로 찾은 버그 2개 + 플러그인 단위 검증, frontmatter 엄격 YAML).

## Non-Goals

- 6단계 전체 감사(커버리지 원장·검증기 1,600줄·샌드박스 증거 승격). setup 이 원 스킬 설치를 안내만 한다.
- 대상 코드 실행 검증. 반증자는 소스만 읽는다.

## Design

| 영역 | 변경 |
|---|---|
| `review.mjs` | `refutationTargets`, `applyRefutations`(불변·판정 없으면 차단 유지·심각도는 내리기만), `ORDER` 끝에 `NEEDS_VALIDATION`, 출력에 `securityRefuter` |
| goldfish 페르소나 | `security_refuter.md` 추가(EGM 리뷰 기본 페르소나 목록에는 넣지 않는다 — 반증 단계에서만) |
| security 에이전트 | 판정 규칙·기준표·도메인 참고 경로 |
| review SKILL | §2.5 반증 단계, 심각도 표에 NEEDS_VALIDATION |
| setup SKILL | 원 스킬 설치 명령 안내 |

## Alternatives Considered

| 안 | 버린 이유 |
|---|---|
| 원 스킬을 통째로 vendoring | 4,800줄 유지 부담. 전체 감사는 OS 샌드박스 전제라 Windows 에서 대부분 needs_validation 으로 떨어진다 |
| 원 스킬을 동반으로만 안내 | 매 리뷰의 오탐·심각도 흔들림은 그대로다. 판정 규칙은 짧고 매번 쓰인다 |
| 모든 리뷰어 지적에 반증 | 비용. 오탐이 수정 루프를 돌리는 비용이 큰 곳은 security CRITICAL/HIGH 다 |

## Risks & Limits

- 반증자도 같은 모델이다. 진짜 취약점을 잘못 rejected 할 수 있다 → rejected 는 사유와 함께 review.md 에 남겨 사람이 본다.
- 반증자가 형식을 깨면 차단을 유지한다(보수적). 비용은 한 항목당 서브에이전트 1회.
