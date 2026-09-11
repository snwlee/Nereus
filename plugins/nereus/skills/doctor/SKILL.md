---
name: doctor
description: Diagnose conflicts between Nereus and other harness plugins — shadowed MCP servers, agents and bins, shared hook points, and curated double-gate combinations. Reports; never uninstalls. 트리거: "충돌", "중복", "플러그인 정리", 새 플러그인 설치 직후.
---

# doctor

플러그인을 여러 개 깔면 **설치는 전부 성공하는데 서로 가린다.** 이름 공간이 하나뿐인
표면(MCP 서버명·에이전트명·bin)에서 한쪽이 다른 쪽을 덮고, 아무도 오류를 내지 않는다.
이 스킬은 그걸 찾아 보여준다. 고치는 것은 그다음 문제다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/doctor.mjs" [--all] [--remove <name>]
```

## 심각도 세 단계

| 단계 | 무엇 | 예 |
|---|---|---|
| **HIGH** | 한쪽이 다른 쪽을 **가린다**. 이름 공간이 하나뿐인 표면에서 일어난다. | 두 플러그인이 같은 MCP 서버명(`chrome-devtools`)·에이전트명·bin 이름을 쓴다 |
| **MEDIUM** | 이름은 다른데 **같은 일을 두 번 한다**. 큐레이션 표에 손으로 적어 둔 조합만 낸다. | superpowers 의 완료 게이트와 `nereus:finish` 가 매 마무리마다 중복 검증 |
| **LOW** | 같은 지점에 둘 다 붙어 **순서가 불확실**하다. 대개 정상이다. | 두 플러그인이 `PostToolUse`/`Edit` 에 훅을 건다 |

**LOW 는 기본으로 접는다.** 건수만 한 줄로 알리고 `--all` 로 펼친다. 매번 펼치면 경고 피로로
HIGH 까지 같이 무시하게 된다 — 시끄러운 진단기는 안 쓰이고, 안 쓰이면 없는 것과 같다.

## 처방 세 단계

1. **자동** — `permissions.deny` 한 줄로 끝나는 것(MCP 서버, 서브에이전트). doctor 가 적용할 수
   있다. 적용하면 원장에 무엇을 어디에 썼는지 남기고 `--undo` 로 되돌릴 수 있다.
2. **수동** — 파일로 못 고치는 것. `수동:` 접두와 함께 무엇을 해야 하는지 그대로 보여준다.
3. **제거** — `--remove <name>` 은 `/plugin uninstall <name>` **문자열만 출력한다.**
   doctor 는 그 명령을 실행하지 않는다. 플러그인을 지우는 것은 사용자가 자기 손으로 할 일이다.

### 스킬 충돌은 파일로 고칠 수 없다

`settings.json` 의 `skillOverrides` 는 **플러그인 스킬에 적용되지 않는다**(문서 명시).
`permissions.deny` 로 끌 수 있는 것은 MCP 서버와 서브에이전트뿐이다. 그래서 스킬이 겹치는
충돌(MEDIUM 큐레이션 항목 대부분)은 전부 수동 처방이고, doctor 는 **고칠 수 있는 척하지
않는다.** `/plugin` 화면에서 해당 스킬이나 플러그인을 직접 끄는 절차만 안내한다.

## 수용과 되돌리기

- `--all` — LOW 까지 전부 펼친다.
- `--undo` — doctor 가 적용했던 처방을 되돌린다. **복원이 아니라 역편집이다.** 기록한 경로
  하나만 보고, 그 경로가 그 사이 바뀌었으면 **덮지 않고 멈춰서** 기대값과 실제값을 보여준다.
  이미 손으로 지워 둔 경우는 성공으로 끝낸다.
- `--unack <fingerprint>` — 수용(ack)을 취소해 다시 알리게 한다.

수용은 지문(fingerprint)에 묶인다. 지문에는 양쪽 플러그인의 **이름@버전**이 들어 있어서,
어느 한쪽이 업데이트되면 지문이 바뀌고 **다시 알린다.** 수용이 영구 침묵이 되지 않게 하는
장치다 — 버전이 오르면 충돌의 성격도 달라질 수 있다.

수용 기록은 판정 스코프를 따라 나뉜다. 전역 판정은 `~/.config/nereus/doctor-ledger.jsonl`,
프로젝트 판정은 `<project>/.nereus/doctor-ack.jsonl` 에 남는다. 프로젝트에서 한 수용을 전역에
남기면 다른 프로젝트에서도 조용해져, 거기서는 여전히 시끄러워야 할 충돌을 놓친다.

## 언제 도는가

- `/nereus:setup` 의 감지 단계에서 함께 돈다.
- SessionStart 가 **새 플러그인을 발견하면** 한 줄로 알리고 여기로 보낸다. 첫 실행은 조용하다
  (기준선만 남긴다). compact 에서는 알리지 않는다.
- 직접 부를 때 — 새 하네스를 깔았는데 뭔가 이상해진 순간이 정확히 이 도구가 필요한 때다.

## 기본은 읽기 전용

인자 없이 부르면 **아무 파일도 쓰지 않는다.** 진단기가 묻지 않고 고치면 사용자는 자기 설정이
언제 바뀌었는지 모른다. 쓰기는 언제나 명시적 적용을 거친다.
