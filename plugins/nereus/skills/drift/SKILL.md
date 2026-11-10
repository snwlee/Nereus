---
name: drift
description: Detect drift between checked-in specs/READMEs and the current code — a deterministic reference check, then an agent comparison per doc. 트리거: "드리프트", "스펙이랑 코드 어긋", "문서가 낡았", "drift report".
---

# drift

nereus:common 규칙을 따른다. 출처: google/elephant-goldfish-model (Apache-2.0) `egm-drift-report` — `NOTICE` 참고.

문서가 말하는 것과 코드가 하는 것의 차이만 보고한다. 맞는 부분은 쓰지 않는다. 읽기 전용 — 코드도 문서도 고치지 않는다.

## 1. 대상

인자가 없으면 기본은 `openspec/specs/` (OpenSpec 기준선), 없으면 `docs/`, 그것도 없으면 루트의 README 들이다. 묻지 않고 고르고 알린다.

## 2. 기계 거름망

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/drift/scripts/drift.mjs" <문서 또는 디렉터리>...
```

문서마다 백틱·링크로 가리킨 **경로**와 호출 형태(`name()`)로 적힌 **심볼**을 뽑아 존재를 판정한다.
경로는 문서 폴더·저장소 루트·추적 파일의 접미사 중 하나로 맞으면 존재한다. 심볼은 문서를 뺀 저장소에서 `git grep -w` 한다.

- `missingPaths`·`missingSymbols` 는 **후보**다. 스펙 시나리오의 예시 경로(대상 프로젝트의 `Assets/...` 같은 것), 런타임에 생기는 경로(`.nereus/...`)는 드리프트가 아니다. 문장을 읽고 가른다.
- `uncheckedSymbols` 는 git 저장소가 아니어서 못 본 것이다. 없다고 보고하지 않는다.

## 3. 의미 비교 (문서마다, 순서대로)

한 번에 한 문서씩 한다 — 여러 문서를 동시에 열면 출력이 넘친다.

1. 문서를 읽고 의도·요구·언급한 파일과 심볼을 잡는다. OpenSpec 스펙이면 `<!-- enforced: ... -->` 주석이 구현 위치다.
2. 해당 코드를 `codegraph_explore`(있으면) 또는 검색으로 찾아 **지금** 내용을 읽는다. 기억에 기대지 않는다.
   경로가 문서에 없어 검색으로 찾았으면 "링크를 문서에 추가하면 다음 검사가 싸진다"를 권고로 남긴다.
3. 차이를 본다:
   - **누락 기능** — 문서에 있는데 코드에 없는 로직
   - **불완전 모델** — 문서가 말한 필드가 없는 타입·구조체
   - **지름길** — 동적이어야 할 곳의 하드코딩
   - **구조 이탈** — 문서와 다른 패턴·라이브러리
   - **문서에 없는 코드** — 어떤 문서도 말하지 않는 로직도 드리프트다

## 4. 보고

`docs/drift/YYYY-MM-DD.md` 에 문서마다 아래 형식으로 덧붙인다. 채팅에는 경로와 드리프트 있는 문서 수만 말한다.

```markdown
## <문서 경로>

- <구체적인 어긋남: 문서 위치 → 코드 위치, 무엇이 다른가>
```

차이가 없으면 `No drift detected.` 한 줄.

고치는 것은 이 스킬의 일이 아니다. 고칠 문서가 있으면 OpenSpec change 로, 고칠 코드가 있으면 `nereus:intake` 로 넘긴다는 한 줄을 끝에 남긴다.
