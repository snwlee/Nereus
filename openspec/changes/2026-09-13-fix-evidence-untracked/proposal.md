# fix-evidence-untracked

## Why

완료 게이트의 evidence 해시가 **추적되지 않은 파일의 내용 변경을 못 본다.**

실측(2026-09-13, CloakBrowser 작업 중 우연히 드러남): 새 파일 `cloak.mjs` 를 만들어
테스트를 돌리니 FAIL, 파일을 고쳐 다시 돌리니 PASS 였는데 **해시가 둘 다
`8e3293f791397a69` 로 같았다.** 재현:

```
추적되지 않은 파일 수정 전: 8e3293f791397a69
수정 후                : 8e3293f791397a69   ← 같다
```

원인은 `workTreeHash` 가 쓰는 세 명령이다.

| 명령 | 미추적 파일에 대해 |
|---|---|
| `rev-parse HEAD` | 무관 |
| `status --porcelain` | **이름만** 낸다. 내용은 안 본다 |
| `diff HEAD` | **추적 파일만** 본다 |

그래서 새 파일을 만들어 고치는 동안 — 즉 **신규 기능을 개발하는 내내** — 해시가 안 변한다.
한 번 PASS 를 기록해두면 그 뒤로 코드를 아무리 고쳐도 evidence 가 FRESH 로 남고,
`nereus:finish` 의 완료 게이트가 **낡은 통과 기록을 현재의 통과로 읽는다.**

에러가 아니라 조용히 뒤집히는 쪽이다 — `countScope` 가 188개를 0개로 센 것과 같은 자리다.

## What Changes

- `workTreeHash` 가 `git ls-files --others --exclude-standard -z` 로 미추적 파일을 모으고
  `git hash-object --stdin-paths` 로 **내용 지문**을 받아 해시에 넣는다.
  내용 해시를 우리가 계산하지 않는다 — 인코딩·심볼릭링크·큰 파일 처리를 다시 정하게 된다.
- **gitignore 된 것은 뺀다**(`--exclude-standard`). 빌드 산출물로 매번 STALE 이 되면
  사람이 게이트를 꺼버린다. 끄게 만드는 게이트는 게이트가 아니다.
- 못 본 경우(`ls-files` 실패)와 개수 불일치를 **빈 값으로 뭉개지 않는다.**
  `untracked:unknown` · `untracked:mismatch:...` 를 지문에 남긴다.
  빈 문자열이면 "미추적 파일 없음"과 구분되지 않는다.
- 회귀 테스트는 **실제 git 저장소**에서 돈다. 주입한 run 픽스처는 우리가 부르는 인자
  자체가 틀린 경우를 못 잡는다 — `Ruling: 검사기 픽스처는 하네스 출력이 아니라 실제
  프로젝트 산출물에서 뜬다` 가 같은 것을 말한다.

## 비용

측정(이 저장소, 10회 평균): 기존 3콜 38.5ms → `ls-files` +15.0ms.
미추적 파일이 있으면 `hash-object` 가 한 번 더 붙는다.
`pre-tool-guard` 는 PreToolUse 마다 `evidenceStatus` 를 부르므로 이 비용이 매 호출에 붙지만,
훅 예산(5~10초) 대비 무시할 수준이다. **정확성을 포기할 자리가 아니다** —
완료 게이트가 틀리면 나머지 게이트가 전부 의미를 잃는다.

## Impact

- 영향 스펙: `harness` (요구사항 1개 추가)
- 영향 코드: `plugins/nereus/hooks/scripts/lib/evidence.mjs`
- 기존 evidence 기록은 해시 계산식이 바뀌므로 **한 번 STALE 이 된다.** 의도된 것이다 —
  틀린 FRESH 보다 낫고, 테스트를 한 번 다시 돌리면 회복된다.
