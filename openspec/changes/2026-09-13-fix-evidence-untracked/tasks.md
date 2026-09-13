# tasks — fix-evidence-untracked

- [x] T1. 실제 git 저장소에서 도는 실패 테스트
  - Files: Modify `tests/lib/evidence.test.ts`
  - Steps:
    - [x] 임시 디렉터리에 git init → 커밋 → 미추적 파일 생성·수정으로 해시 비교
    - [x] 추적 파일 변경 · 무변경 · gitignore 회귀 테스트를 같이 넣는다
    - [x] 실패 확인: 미추적 내용 변경 테스트만 FAIL, 나머지 셋은 PASS
  - Done when: 구멍 하나만 빨갛다

- [x] T2. untrackedDigest 를 해시에 더한다
  - Files: Modify `plugins/nereus/hooks/scripts/lib/evidence.mjs`
  - Steps:
    - [x] `ls-files --others --exclude-standard -z` + `hash-object --stdin-paths`
    - [x] `run` 데코레이터가 `input` 을 넘길 수 있게 두 번째 인자를 받는다(기존 호출과 호환)
    - [x] 실패·개수 불일치를 빈 값으로 뭉개지 않는다
    - [x] 통과 확인 + 실제 저장소에서 재현 확인
  - Done when: 전체 테스트 초록이고 실측 재현이 뒤집힌다
