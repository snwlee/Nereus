---
name: build
description: 태스크를 TDD로 구현한다. 테스트 러너가 있으면 실패 테스트→구현→통과를 강제하고, 없으면 러너 세팅을 한 번 제안한다. 게이트는 테스트 전부 통과 + ooo qa 기계 검증. "/nereus:build", "구현해", "이 태스크 해줘", "코드 작성" 요청 시, 그리고 spec 단계 직후 자동으로 사용.
---

# build

nereus:common 규칙을 따른다. 담당 에이전트: 스택에 따라 backend / frontend / app. 두 스택 이상이면 태스크별로 나눈다.

## 1. TDD 가능 환경 판별

`nereus` 훅 라이브러리의 `detectTestRunner`와 같은 기준이다.
- Flutter: `pubspec.yaml`에 `flutter_test` 또는 `test` → `flutter test`
- Spring: `gradlew`/`build.gradle*` → `./gradlew test`, `pom.xml` → `mvn test`
- Node: `package.json` test 스크립트, 또는 vitest/jest 설정 파일

러너가 있으면 **TDD 강제**. 없으면 사용자에게 딱 한 번 묻는다: "테스트 환경이 없습니다. 세팅할까요?" 승인하면 `references/<stack>.md`의 세팅을 적용한다. 거절하면 TDD 없이 진행하고 handoff.md 테스트 상태에 "테스트 없음(사용자 선택)"을 적는다.

## 2. 태스크 루프

tasks 파일에서 첫 미완료 태스크를 고른다. 태스크마다:

1. **RED**: 완료 조건을 테스트로 옮긴다. 실행해서 **실패를 확인**한다. 실패 출력 첫 줄을 기록한다. 실패하지 않으면 테스트가 잘못된 것이다.
2. **GREEN**: 테스트를 통과시키는 최소 구현. 처음 쓰는 API는 Context7로 확인.
3. **REFACTOR**: 중복 제거, 이름 정리. 테스트 다시 실행.
4. tasks 체크박스를 채우고 handoff.md의 "완료"와 "다음"을 갱신한다.

`tdd-guard` 훅이 "테스트 없이 소스 편집" 경고를 내면, 그 파일의 테스트를 먼저 쓴다. 경고를 무시하고 넘어가지 않는다.

설정·마이그레이션·생성 파일(`tdd.exclude`)은 테스트 대상이 아니다.

## 3. 막혔을 때

같은 태스크에서 접근을 두 번 바꿔도 안 되면 `ooo unstuck`을 부른다. 실패한 접근은 handoff.md에 이유와 함께 남긴다.

## 4. 게이트

- 전체 테스트 실행 → 전부 통과. 출력을 인용한다.
- `ooo qa`로 기계 검증(빌드·린트·테스트)을 한 번 더 돌린다. `ooo`가 없으면 스택별 빌드 명령(`flutter analyze`, `./gradlew build`, `npm run build` 또는 `tsc --noEmit`)으로 대체한다.
- `[flow]` 태스크가 포함됐으면 `nereus:e2e`를 먼저 실행한 뒤 `nereus:review`로 넘어간다. 아니면 바로 review.
