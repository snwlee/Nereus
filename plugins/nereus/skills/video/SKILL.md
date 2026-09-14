---
name: video
description: 영상·립싱크·오디오 생성 (Muapi, 유료 키). 텍스트→영상, 이미지→영상, 영상 편집, 립싱크, 음악·효과음. 트리거 "영상 만들어", "동영상 생성", "립싱크", "t2v", "i2v", "효과음 만들어".
---

# video

nereus:common 규칙을 따른다. 담당 에이전트: 스택에 따름 — 이 스킬은 에셋 생성 도구다.

## 0. 이 스킬이 여는 것

Gemini 웹세션(`nereus:image`)은 **이미지만** 만든다. 영상·립싱크·오디오는 못 한다.
이 스킬은 그 빈자리를 **유료 키**로 채운다.

| 하고 싶은 것 | 능력 | 어디서 |
|---|---|---|
| 이미지 (무료) | — | **`nereus:image`** — 여기 오지 않는다 |
| 텍스트 → 영상 | `t2v` | 이 스킬 |
| 이미지 → 영상 | `i2v` | 이 스킬 |
| 영상 → 영상(편집·워터마크 제거·모션) | `v2v` | 이 스킬 |
| 립싱크 | `lipsync` | 이 스킬 |
| 음악·효과음 | `audio` | 이 스킬 |

**편집 타임라인이 필요하면 이 스킬이 아니다.** 여러 씬을 붙이고 자막·모션을 얹는 일은
`hyperframes` 계열이 한다. 여기는 **클립 한 개를 생성**하는 곳이다.

## 1. 키

```bash
export MUAPI_API_KEY=...     # https://muapi.ai/access-keys
```

**키가 없으면 이 스킬은 아무것도 못 한다.** 그때는 조용히 죽지 않고 그렇게 말한다.
무료로 되는 이미지 생성은 `nereus:image` 가 키 없이 계속 한다 — 이 스킬로 우회하지 않는다.

## 2. 모델을 이름으로 고르지 않는다

어떤 모델이 있는지는 **`muapi-models.json` 이 정한다**(537종, 출처·확인일 포함).
스킬도 코드도 모델 이름을 외우지 않는다 — 상류가 정하고 상류가 바꾼다.

```bash
# 이 능력에 무엇이 있는지 먼저 본다
node -e 'import("./plugins/nereus/skills/image/scripts/muapi-catalog.mjs").then(m=>
  console.log(m.pickModels("t2v").slice(0,10).map(x=>x.id).join("\n")))'
```

`muapi-catalog.mjs` 의 `pickModels(capability)` 가 목록을, `catalogSummary()` 가 능력별 개수를 준다.

## 3. 생성

`muapi-client.mjs` 가 상류 계약을 감싼다:

```
POST https://api.muapi.ai/api/v1/{endpoint}   헤더 x-api-key   →  { request_id }
GET  https://api.muapi.ai/api/v1/predictions/{request_id}/result   →  status: completed 까지 폴링
```

**실행은 CLI 로 한다** (`scripts/muapi-cli.mjs`):

```bash
C="plugins/nereus/skills/image/scripts/muapi-cli.mjs"
node "$C" summary                      # 능력별 모델 수 (키 불필요)
node "$C" models t2v                   # 이 능력의 모델 목록 (키 불필요)
node "$C" generate --capability t2v --prompt "..." \
     --input aspect_ratio=9:16 --input resolution=720p \
     --out ./assets --name promo       # 생성 → 폴링 → 내려받기
```

모듈로도 쓴다:

```js
import { resolveModel, buildRequest, resultUrl } from "./plugins/nereus/skills/image/scripts/muapi-client.mjs";
const model = resolveModel({ capability: "t2v" });          // 또는 { capability, model: "<id>" }
const req = buildRequest({ endpoint: model.endpoint, prompt, key, inputs: { aspect_ratio: "9:16" } });
```

`aspectRatios`·`durations`·`resolutions` 는 **모델마다 다르다.** 카탈로그 항목에 실려 있으니
거기 있는 값만 넣는다. 지어낸 값을 보내면 상류가 거부한다.

## 4. 규칙

- **키 값을 출력하지 않는다.** 로그·에러·커밋 어디에도 남기지 않는다.
- **생성 비용이 든다.** 반복 생성 전에 무엇을 몇 번 돌릴지 사용자에게 말한다.
- **모델 이름·가격·쿼터를 스킬에 적지 않는다.** 카탈로그에도 가격은 없다 — 운영값이다.
- 결과물은 `nereus-game:asset` 의 반입 규칙을 따른다(게임 에셋인 경우).
- 상류가 모델을 늘리면 `muapi-models.json` 만 다시 뽑는다. 코드는 그대로다.

## 5. 출처

모델 카탈로그는 [Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI)(**MIT**)의
`packages/studio/src/models.js` 에서 뽑았다. 그쪽은 Muapi 의 `schema_data.json` 과 동기화된 것이고,
호출 계약은 [api.muapi.ai/openapi.json](https://api.muapi.ai/openapi.json) 으로 직접 대조했다(2026-09-14).

상류는 브라우저 스튜디오(React)다. **그 UI 를 가져오지 않았다** — 에이전트는 헤드리스로 부르고,
필요한 것은 UI 가 아니라 **모델 카탈로그와 호출 계약**이었다.
