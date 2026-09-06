---
name: finish
description: 완료 게이트(evidence+무결성) → 커밋, archive, tasks 체크, handoff 갱신. "마무리", "커밋하고 정리" 요청 시, review 직후.
---

# finish

nereus:common 규칙을 따른다. 담당 에이전트: writer(문서·아카이브), 커밋은 이 세션이 직접.

1. **게이트**: 먼저 완료 게이트를 돌린다.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/finish/scripts/gate.mjs"          # 미커밋 변경 기준
   node "${CLAUDE_PLUGIN_ROOT}/skills/finish/scripts/gate.mjs" --base main
   ```
   세 가지를 본다. (a) **테스트 evidence**가 FRESH이고 통과인가 — MISSING/STALE이면 `run-tests.mjs`로 다시 돌린다. (b) **완료 무결성** — diff에 TODO/FIXME, TBD, 건너뛴 테스트, 스텁, 테스트 없는 가드 제거가 있으면 차단. (c) **연결 검사** — 새 실행 스크립트를 아무 데서도 호출하지 않으면(`unwired`) 차단한다. 테스트가 import 하는 것은 연결이 아니다. 버전을 올렸는데 handoff.md를 그대로 두면(`handoff_stale`) 차단한다. 각 항목을 고치거나, 정당한 이유가 있으면 handoff.md Rulings에 이유를 적고 사용자에게 확인받는다. 조용히 넘기지 않는다.
   tasks 파일에 이 작업 단위의 태스크가 전부 체크됐는지 확인한다. 아니면 build로 돌려보낸다.
2. **커밋**: `git status`, `git diff --stat`을 보고 conventional commit 메시지를 만든다. 여러 관심사가 섞였으면 나눠 커밋한다. 시크릿·`.env`·빌드 산출물이 스테이징되지 않았는지 확인한다.
3. **스펙 정리**: OpenSpec 프로젝트면 `/opsx:archive`로 change를 아카이브한다. spec-kit이면 `/speckit.converge`로 남은 작업이 없는지 확인한다.
4. **문서**: 사용자에게 보이는 동작이 바뀌었으면 README나 docs를 갱신한다. 설계 결정이 있었으면 `docs/adr/`에 ADR 한 장(writer가 archify로 다이어그램을 붙일 수 있다).
5. **handoff**: `.nereus/handoff.md`를 전체 재작성한다. 현재 단계는 "완료" 또는 다음 태스크. 이 단위에서 실패했던 접근이 있으면 남긴다.
6. **브랜치**: main이 아닌 브랜치면 "푸시할까요? PR을 만들까요? 브랜치를 유지할까요?"를 한 번 묻는다. 묻지 않고 푸시하지 않는다.
7. **메모리**: claude-mem이 있으면 세션 요약은 자동이다. 없으면 handoff.md가 유일한 기록임을 알린다.

마지막 메시지는 이 세션을 보지 않은 사람이 읽어도 되게: 무엇을 했고, 무엇이 검증됐고, 무엇이 남았는지 세 줄.
