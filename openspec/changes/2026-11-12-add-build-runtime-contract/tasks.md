# tasks — add-build-runtime-contract

T1 은 RED→GREEN 을 한 태스크 안에서 끝내고 한 커밋으로 남긴다. 중간 상태(빨간 스위트)를 커밋하지 않는다.

기준선(2026-11-12, Windows): `npx vitest run` → Test Files 14 failed | 144 passed. 실패 14개는 이 change 와 무관한 기존 실패다(19 tests, 목록 `.nereus/baseline-fails.txt` 의 ` FAIL ` 줄). 완료 조건은 "` FAIL ` 테스트 줄 목록이 기준선과 동일"이다.

- [x] T1. build 계약 파일 + 대조 테스트
  - Files: Create `tests/skills/build-contract.test.ts`, Create `plugins/nereus/skills/build/assets/runtime-contract.json`, Modify `plugins/nereus/skills/build/SKILL.md`
  - Interfaces:
    - `checkContract(contract: object, env: { skillMd: string, exists: (pluginRel: string) => boolean, evidenceKeys: string[] }): string[]` — 테스트 파일 안의 순수 함수. 오류 메시지 배열, 정상이면 `[]`.
    - 실제 env: `skillMd` = `fs.readFileSync("plugins/nereus/skills/build/SKILL.md")`, `exists(p)` = `fs.existsSync(path.join("plugins/nereus", p))`, `evidenceKeys` = `Object.keys(recordEvidence(".", {command:"x", exitCode:0}, {hash: () => "h", now: 1, writeFile: () => {}}))` (no-op writeFile 이라 아무것도 쓰지 않는다). 경로는 저장소 루트(vitest cwd) 상대.
  - Steps:
    - [x] 테스트 작성. `checkContract` 는 spec 의 최상위 키 9개 정확 일치 · `skill === "build"` · `schema_version === 1` 과 `contract.noDrift` 1~6(게이트 check 5자 이상, evidence 키는 정렬 후 비교)을 모두 안에서 검사한다. `it` 목록:
      1. `SKILL.md 가 assets/runtime-contract.json 을 가리킨다` — `expect(skillMd).toContain("assets/runtime-contract.json")`
      2. `실제 계약은 오류가 없다` — `expect(checkContract(real, env)).toEqual([])` (먼저 `expect(fs.existsSync(CONTRACT)).toBe(true)` — 없으면 여기서 실패하고 JSON.parse 에 가지 않는다)
      3. `출처를 밝힌다` — `real.source` 가 `{repo: "NVIDIA/auto-ontology", license: "Apache-2.0"}` 를 포함
      4. 음성 사례(각각 `structuredClone(real)` 을 변형해 `checkContract(mutated, env).length > 0`): `gates` 키 삭제 · workflow output 에 `"Ghost"` 추가 · handoff to `"nereus:no-such-skill"` · gate script `"skills/build/scripts/nope.mjs"` · gate check `"SKILL.md 에 없는 문장"` · `required_fields.EvidenceRecord` 에 `"duration"` 추가 · `required_fields.Ghost` 추가 · 최상위에 `extra` 키 추가 · `artifacts.RunTests.path` 를 `"skills/build/scripts/nope.mjs"` · handoff to `"debug"`(접두사 없음) · handoff to `"nereus:pdf"`(존재하지만 SKILL.md 미언급) · 실제 계약에 `evidenceKeys` 를 `[...keys, "duration"]` 로 바꾼 env
    - [x] 실패 확인: Run `npx vitest run tests/skills/build-contract.test.ts` · Expected: FAIL (계약 파일 없음 · SKILL.md 언급 없음)
    - [x] 계약 작성 — 아래 그대로:
      ```json
      {
        "schema_version": 1,
        "skill": "build",
        "source": { "repo": "NVIDIA/auto-ontology", "path": "skills/*/assets/runtime-contract.yaml", "license": "Apache-2.0" },
        "workflows": {
          "tdd_cycle": { "input": ["TasksFile", "TddOverride"], "output": ["TasksFile", "EvidenceRecord"] },
          "gate": { "input": ["EvidenceRecord"], "output": [] }
        },
        "artifacts": {
          "TasksFile": { "kind": "runtime", "path": "spec 단계의 tasks.md (OpenSpec change 또는 spec-kit 기능 디렉터리)" },
          "EvidenceRecord": { "kind": "runtime", "path": ".nereus/evidence.json" },
          "TddOverride": { "kind": "runtime", "path": ".nereus/tdd-override" },
          "RunTests": { "kind": "script", "path": "skills/build/scripts/run-tests.mjs" }
        },
        "required_fields": { "EvidenceRecord": ["command", "exitCode", "hash", "at"] },
        "statuses": ["RED", "GREEN", "STALE", "테스트 없음(사용자 선택)"],
        "gates": [
          { "id": "red-first", "check": "실패를 확인" },
          { "id": "evidence-fresh", "check": "마지막 편집 뒤에 반드시 한 번 더 돌린다", "script": "skills/build/scripts/run-tests.mjs" },
          { "id": "all-tests-pass", "check": "전체 테스트 실행 → 전부 통과", "script": "skills/build/scripts/run-tests.mjs" },
          { "id": "stack-build-check", "check": "스택별 빌드·정적 검사를 한 번 더 돌린다" },
          { "id": "design-render-round", "check": "렌더 라운드", "script": "skills/design/scripts/design-feedback.mjs" }
        ],
        "handoffs": [
          { "when": "버그·실패 테스트·예상과 다른 동작", "to": "nereus:debug" },
          { "when": "디자인 표면(스타일시트·디자인 토큰·시각 마크업)을 만졌다", "to": "nereus:design" },
          { "when": "[flow] 태스크가 포함됐다", "to": "nereus:e2e" },
          { "when": "게이트 통과", "to": "nereus:review" }
        ]
      }
      ```
    - [x] SKILL.md 의 `nereus:common 규칙을 따른다. 담당 에이전트: …` 줄 다음의 빈 줄 뒤에 이 한 줄과 빈 줄 하나를 넣어 `## 1.` 과 띄운다(본문 §1~§4 는 그대로):
      `입출력·상태·게이트·handoff 선언: \`assets/runtime-contract.json\` — \`tests/skills/build-contract.test.ts\` 가 이 문서와 대조한다. 이 문서의 게이트 문구를 바꾸면 계약도 같이 바꾼다.`
    - [x] 통과 확인: Run `npx vitest run tests/skills/build-contract.test.ts tests/skills/laziness-ladder.test.ts tests/skills/build-tier.test.ts` · Expected: PASS
    - [x] 회귀 확인: Run `npx vitest run` · Expected: Test Files 14 failed | 145 passed, 실패 목록이 기준선과 같음
  - Done when: 대상 테스트 PASS, 전체 스위트의 실패 목록이 기준선과 동일

## Global Constraints

- 플러그인 런타임 코드는 Node 표준 라이브러리만. 이 change 는 런타임 코드를 추가하지 않는다(JSON + 테스트).
- 계약의 `statuses`·`gates[].check` 는 SKILL.md 의 실제 문구여야 한다 — 테스트가 강제한다.
