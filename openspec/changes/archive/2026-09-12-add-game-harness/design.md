# design — add-game-harness

## 결정 1: 별도 플러그인, 확장점으로 결합

게임 도메인을 `nereus` 본체에 합치지 않는다. 근거 셋:

1. **라우팅 경쟁이 실재한다.** `router.mjs` 의 `MAX_HITS = 2` 는 한 프롬프트당 최대 두 스킬만 지목한다.
   게임 라우트 10여 개를 코어에 섞으면 웹·앱 작업 프롬프트에서 게임 라우트가 자리를 뺏는다.
2. **완료의 정의가 다르다.** 코어의 finish 는 커밋·아카이브다. 게임은 롤아웃·지표 관측이 끝이다.
3. **환경이 다르다.** 실제 게임 개발은 Windows 데스크탑(RTX 3080)에서 돌고, 이 저장소 작업은 macOS 에서 돈다.
   플러그인 경계가 있으면 한쪽만 설치·갱신할 수 있다.

## 결정 2: 확장점은 두 개, 데이터 선언으로만

형제 플러그인이 코드를 주입하지 않는다. `nereus-extension.json` 이라는 **순수 데이터 파일**만 읽는다.

```json
{
  "routes": [{ "skill": "nereus-game:roblox", "why": "로블록스 유즈맵", "re": "로블록스|roblox|rojo|luau" }],
  "stacks": [{ "name": "roblox", "marker": "default.project.json" }]
}
```

정규식은 문자열로 받아 `new RegExp(src, "i")` 로 만든다. 컴파일 실패는 그 항목만 버린다.
코드를 `import()` 하지 않는 이유: 형제 플러그인의 런타임 오류가 코어 훅을 죽이면 안 되고,
훅은 타임아웃 5~10초 안에 끝나야 한다.

## 결정 3: 발견은 enabledPlugins 로만

`lib/plugin-inventory.mjs` 가 이미 `settings.json` 의 `enabledPlugins` 와 `installPath` 로 설치 플러그인을 연다.
그 경로를 재사용한다. **디스크 존재로 판단하지 않는다** — 설치됐지만 꺼둔 플러그인의 라우트가 살아나면
사용자가 끈 것이 안 꺼진다.

## 결정 4: 코어 우선, 상한은 병합 후 적용

병합은 `[...CORE, ...ext]` 순서다. `MAX_HITS` 는 병합된 목록에 적용되므로 확장이 코어를 밀어낼 수 없다.
스택도 같다 — `detectStack` 은 코어 마커를 먼저 검사한다.

## 결정 5: 로블록스 테스트는 2단

| 단 | 도구 | 무엇을 | 언제 |
|---|---|---|---|
| 1 | lune (로컬, 초 단위) | 순수 Luau 로직 단위테스트 | build 게이트 매 태스크 |
| 2 | Open Cloud **Luau Execution API** | 실제 Roblox 서버에서 DataModel 포함 통합테스트 | finish 게이트 |

1단만으로는 DataModel·Roblox API 의존 코드를 검증할 수 없고, 2단만 쓰면 태스크마다 업로드가 필요해 느리다.
`Roblox/place-ci-cd-demo` 는 **아카이브된 샘플**이라 의존하지 않고 CI 형태(Selene → StyLua → Rojo 빌드 →
업로드 → Luau Execution → 배포)의 청사진으로만 참조한다.

## 결정 6: 도구 부재는 실패가 아니다

StyLua·selene·lune 이 PATH 에 없으면 훅은 **종료 코드 0** 으로 끝난다.
근거: 이 저장소를 여는 모든 세션이 Luau 툴체인을 갖고 있지 않다(이 맥이 그렇다).
도구 부재로 편집이 막히면 하네스 자체를 고칠 수 없게 된다. 설치 안내는 `nereus:setup` 의 몫이다.

## 미해결

- Nintendo Developer Portal 승인 여부 미확인 — Switch 어댑터는 이 변경 범위 밖이라 착수를 막지 않는다.
- RTX 3080(10~12GB VRAM)에서 TRELLIS·YuE 실구동 여부 미검증 — 에셋 파이프라인은 이 변경 범위 밖이다.
