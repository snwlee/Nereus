---
name: computer-use
description: Operate native desktop windows (Studio dialogs, app settings, off-browser windows) safely — pick the channel (Cua Driver → Orca → vision → Lume), confirm the target, send pid-targeted input, verify every step, ask before irreversible actions. 트리거: "저장 버튼 눌러", "앱 창 조작", "대화상자", "컴퓨터 유즈".
---

# computer-use

nereus:common 규칙을 따른다. 대상은 **페이지가 아니라 창**이다 — 웹 페이지 자동화는 Playwright·aside 가 한다.

## 0. 왜 이 절차인가 (실패 사례 2026-09-24)

osascript `keystroke` 로 Roblox Studio 저장을 시도했다가 다섯 가지가 한꺼번에 틀렸다.

| # | 일어난 일 | 이 스킬의 대응 |
|---|---|---|
| 1 | 대화상자가 **보조 모니터**(x=1955)에 떠 주 화면 캡처에 없었다 | 화면이 아니라 **창** 기준으로 본다(`get_window_state`·`zoom`) |
| 2 | 제목이 50자 제한 초과 → **Save 비활성**. 눌렀다고 착각할 뻔했다 | 누르기 전 `verify_state` 로 `enabled` 확인 |
| 3 | 좌표 클릭이 빗나가 텍스트가 **다른 칸**에 들어갔다 | 좌표보다 **element_token**. 좌표는 캔버스뿐 |
| 4 | 이후 키가 **어디로 가는지 모르는** 상태에서 계속 보낼 뻔했다 | 전역 포커스 입력 금지. **pid 지정** 입력만 |
| 5 | 사람이 휴대폰으로 **원격 제어 중**이었다 | 원격·사람 활동 중이면 `block` |

## 1. 판정 — 매 작업 시작과 되돌리기 어려운 행동 직전

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/computer-use/scripts/probe.mjs"
node "$S" --risk read                                   # 조회만
node "$S" --risk input --target-confirmed               # 입력
node "$S" --risk irreversible --target-confirmed        # 저장·전송·삭제·게시·구매 → ask
node "$S" --risk input --target-confirmed --remote      # 사용자가 원격 제어 중이라고 알면 --remote
node "$S" --risk input --target-confirmed --target-kind dialog --isolation   # 대화상자 / 격리
```

출력의 `layer`·`verdict`·`reasons` 를 그대로 따른다.

| verdict | 행동 |
|---|---|
| `go` | 진행 |
| `ask` | 멈추고 사용자에게 한 줄로 묻는다 (`needs-approval` = 무엇을 저장·전송하는지 적어서, `human-idle-unknown` = 사람 입력 경합을 못 쟀으니 지금 손을 떼고 있는지) |
| `block` | 입력하지 않는다. `reasons` 를 사용자에게 알린다 |

`--target-confirmed` 는 **직접 확인한 뒤에만** 붙인다: 대상 앱·창을 목록에서 찾았고, 그 창의 스냅샷(또는 캡처)을 봤다.
`reasons` 의 `cua-permission-unconfirmed` · `cua-missing` 은 조용히 넘기지 않고 한 번 알린다(아래 §5).

## 2. 통로별 명령

### cua — Cua Driver (1순위)
pid 지정 입력(포커스를 뺏지 않는다), 창 기준 좌표, AX 요소, `verify_state`, 녹화.
```bash
C=~/.local/bin/cua-driver
$C serve &                                   # 데몬 (또는 MCP: cua-driver mcp)
$C call list_apps '{}'
$C call list_windows '{}'                    # 창 id·bounds (모든 모니터)
$C call get_window_state '{"pid":<pid>,"window_id":<wid>}'   # elements[] + element_token + 스크린샷
$C call click '{"pid":<pid>,"element_token":"<token>"}'      # 좌표보다 토큰
$C call set_value '{"pid":<pid>,"element_token":"<token>","value":"..."}'
$C call type_text '{"pid":<pid>,"text":"..."}'
$C call verify_state '{"pid":<pid>,"window_id":<wid>,"expect":[{"element":{...,"enabled":true}}]}'   # 셀렉터 키는 describe 로
$C call zoom '{"pid":<pid>,"window_id":<wid>,"x1":0,"y1":0,"x2":400,"y2":300}'
```
도구 스키마는 추측하지 않는다: `$C describe <tool>` (특히 `verify_state` 의 predicate 키).
MCP 로 쓰려면 `$C mcp-config --client claude` 가 출력하는 `claude mcp add-json ...` 명령을 그대로 실행한다.

### orca — Orca computer-use (2순위, Cua 불가일 때)
가이드는 바이너리가 준다: `orca skills get computer-use`. 추측 금지.
```bash
orca computer list-apps --json
orca computer get-app-state --json ...      # 접근성 스냅샷
orca computer click / set-value / press-key --json ...
```
**대화상자·메뉴·OCR 을 못 본다**(`reasons` 에 `orca-no-dialogs-use-vision`) → 대화상자는 §3 비전으로 확인한다.

### vision — 스크린샷 + 비전 (3순위, 보조)
AX 트리에 안 잡히는 Qt·웹뷰·캔버스. 창 스크린샷을 보고 **창 기준 좌표**로 누른다.
전체 화면 캡처(`screencapture`)는 보조 모니터 창을 놓친다 — 창 bounds 로 자른다
(`screencapture -x -R<x>,<y>,<w>,<h>`, bounds 는 `list_windows` 또는 System Events).

### lume — 격리 VM (선택)
위험하거나 반복 테스트가 필요한 작업. 미설치면 `lume-missing` → 설치(`curl -fsSL https://cua.ai/lume/install.sh`)는
사용자 승인 뒤. macOS VM 이미지는 수십 GB 다.

## 3. 행동 루프 — 한 행동마다

1. **스냅샷**: `get_window_state` (orca: `get-app-state`). 이전 토큰은 버린다.
2. **대상 확인**: 누를 요소의 role·label 이 의도와 맞는가. 비활성이면 누르지 않는다.
3. **입력**: pid 지정. 전역 `keystroke`·`osascript` 입력은 쓰지 않는다.
4. **검증**: `verify_state` 또는 새 스냅샷/캡처로 **결과를 눈으로** 확인한다. 검증 없이 다음 행동으로 가지 않는다.
5. 두 번 연속 결과가 안 바뀌면 멈춘다 — 입력이 어디로 가는지 모르는 상태다. 사용자에게 넘긴다.

## 3.5 Saved steps — 한 번 성공한 조작은 레시피로 남긴다

출처: milind-soni/OpenMausBot `server/saved-steps` (Apache-2.0). 같은 창 조작을 다시 할 때 LLM 판단 없이 재실행한다.

1. **작업 시작 전 먼저 본다**: `node "${CLAUDE_PLUGIN_ROOT}/skills/computer-use/scripts/steps.mjs" list` — 맞는 레시피가 있으면 `run <이름>` 부터.
2. **실행**: `steps.mjs run <이름> [--approved]` — 종료코드 `0` 통과, `3` 실패(이유를 읽고 §3 행동 루프로 직접 이어받는다), `4` 승인 필요·차단.
   최근 2회 연속 실패한 레시피는 막힌다 — 앱이 바뀐 것이다. 직접 조작해 성공하면 다시 저장한다.
3. **저장**: Cua `run_script` 로 흐름을 끝까지 돌려 **결과를 눈으로 확인한 뒤에만** 저장한다.
   `steps.mjs save <kebab-이름> --app <프로세스명> --script <js파일> [--irreversible] [--note "..."]`
   - 대상은 `{role, name}` 으로 쓴다. 스냅샷 토큰(`"s0000002a:11"`)은 다음 실행에서 무효라 거절된다.
   - 마지막 줄은 `return {ok: <검증식>, ...}` — `run_script` 의 `ok` 는 호출 성공일 뿐이다. 실측: 글자가 안 들어갔는데도 `ok:true` 였다.
   - 저장·전송·삭제·게시가 들어간 흐름은 `--irreversible`. 실행할 때마다 승인 뒤 `--approved`.
   - 앱은 이름이 아니라 창(`listWindows` 의 title·app_name)으로 찾는다. 실측: `cua.launch("notepad")` 가 Notepad++ 를 띄워 **사용자의 열린 파일**에 입력이 들어갔다.

실행 경로는 `cua-driver mcp`(stdio, 데몬 불필요). 레시피는 프로젝트 `.nereus/saved-steps/<이름>.json` 에 실행 이력과 함께 남는다.

## 4. 하지 말 것

- 전역 포커스로 키를 보내지 않는다(`System Events keystroke`). 대상이 아닌 앱에 들어간다.
- 주 화면 캡처 한 장으로 "창이 없다"고 판단하지 않는다 — 다른 모니터·Space 에 있다.
- 비활성 버튼을 누르고 성공으로 보고하지 않는다.
- 사람이 원격 제어 중이거나 방금 입력한 상태에서 입력하지 않는다.
- 저장·전송·게시·삭제·구매를 승인 없이 하지 않는다. 조회는 자유다.

## 5. 설치·권한 (사람이 할 일)

| 상태 | 안내 |
|---|---|
| `cua-missing` | `/bin/bash -c "$(curl -fsSL https://cua.ai/driver/install.sh)"` — 설치 스크립트를 먼저 읽고 승인받는다 |
| `cua-permission-unconfirmed` | 맥 앞에서 `~/.local/bin/cua-driver permissions grant` → 손쉬운 사용·화면 기록 허용 |
| `orca-missing` | Orca 앱 설치 후 `orca computer permissions` |
