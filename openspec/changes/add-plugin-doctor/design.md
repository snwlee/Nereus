# design — add-plugin-doctor

## 모듈 배치

공유 로직은 훅 lib 에 둔다. SessionStart 훅과 doctor 스킬이 같은 인벤토리를 읽어야 하고,
훅이 스킬 디렉터리를 가로질러 import 하는 것보다 lib 이 옳은 집이다.

| 파일 | 책임 |
|---|---|
| `hooks/scripts/lib/plugin-inventory.mjs` | 설치·활성 목록 + 플러그인별 충돌 표면 수집 (읽기 전용) |
| `hooks/scripts/lib/plugin-conflicts.mjs` | 구조적 완전일치 판정, 심각도, 지문 |
| `hooks/scripts/lib/plugin-curated.mjs` | 큐레이션 표(superpowers·ecc)와 MEDIUM 판정 |
| `hooks/scripts/lib/doctor-ledger.mjs` | 원장 append, ack 지문, undo 계획(순수) |
| `skills/doctor/scripts/doctor.mjs` | CLI: 리포트 렌더, 처방 적용, undo 실행 |
| `skills/doctor/SKILL.md` | 절차 |

## 데이터 모양

```js
// plugin-inventory
{ name: "ecc@ecc", version: "2.0.0", enabled: false, installPath: "/abs/path",
  surfaces: { skills: ["unified-memory"], hooks: [{ event: "PostToolUse", matcher: "Edit" }],
              mcp: ["chrome-devtools"], agents: ["reviewer"], bins: ["ecc"], mainAgent: null } }

// plugin-conflicts
{ severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools",
  sides: [{ name: "ecc@ecc", version: "2.0.0" }, { name: "nereus@nereus", version: "0.19.3" }],
  scope: "global", fingerprint: "sha256 앞 16자",
  remedy: { applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" } }
```

`remedy.applicable === false` 면 수동 절차 문자열만 갖는다(플러그인 스킬 충돌이 여기 해당).

## 지문

`sha256(kind + "|" + 정렬된 "이름@버전" 두 개 + "|" + unit)` 의 앞 16자. 버전을 포함하므로
업데이트되면 자동으로 재등장한다.

## 저장 위치

| 데이터 | 위치 | 이유 |
|---|---|---|
| 전역 원장 | `~/.config/nereus/doctor-ledger.jsonl` | 전역 설정 변경 기록 |
| 전역 ack | 같은 원장에 `type: "ack"` 줄 | append-only 한 벌 |
| 플러그인 스냅샷 | `~/.config/nereus/plugin-snapshot.json` | 설치·활성은 전역 사건 |
| 프로젝트 ack | `.nereus/doctor-ack.jsonl` | 프로젝트 로컬 override 는 프로젝트 사실 |

## undo 4분기

원장 항목은 `{ path, before, after, fileHash }` 를 갖는다. `path` 는 JSON 포인터 배열
(`["permissions","deny"]` 같은 것).

1. 현재 파일 해시 === `fileHash` → 역편집
2. 해시 다름 + `path` 의 현재 값 === `after` → 그 경로만 역편집
3. 해시 다름 + `path` 의 현재 값 !== `after` → 중단, 경로·기대·실제 보고
4. `path` 부재 → 멱등 no-op 성공

## 왜 의미 유사도를 쓰지 않는가

스킬 description 유사도로 트리거 경쟁을 재려는 유혹이 있다. 쓰지 않는다. 오탐이 많고
실행마다 결과가 흔들려 결정론 게이트라는 Nereus 테제와 충돌한다. 대신 큐레이션 표가 아는 것만
MEDIUM 으로 말하고, 모르는 것은 말하지 않는다.
