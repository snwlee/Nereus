// Muapi 생성 클라이언트 — 이미지·영상·립싱크·오디오.
//
// **Gemini 웹세션을 대체하지 않는다.** 무료로 되는 이미지는 계속 gemini_cli.py 가 한다.
// 이것은 **웹세션이 못 하는 것**을 위한 유료 경로다: 텍스트→영상, 이미지→영상, 립싱크.
// 그래서 키가 없으면 **조용히 죽지 않고** 무엇이 없어서 못 하는지 말한다.
//
// 상류 계약(https://api.muapi.ai/openapi.json, 2026-09-14 확인):
//   POST /api/v1/{endpoint}  헤더 x-api-key  →  { request_id }
//   GET  /api/v1/predictions/{request_id}/result  →  status: completed 까지 폴링
import { pickModels } from "./muapi-catalog.mjs";

const BASE = "https://api.muapi.ai/api/v1";

/** 키를 환경에서 꺼낸다. **값은 어떤 경로로도 출력하지 않는다.** */
export function requireKey(env = process.env) {
  const key = env.MUAPI_API_KEY;
  if (!key) {
    throw new Error(
      "MUAPI_API_KEY 가 없다. https://muapi.ai/access-keys 에서 만들어 환경변수로 넣는다. " +
        "무료로 되는 이미지 생성은 키 없이 gemini_cli.py 를 쓴다.",
    );
  }
  return key;
}

/** 능력(+선택적 모델 id)으로 쓸 모델을 정한다. */
export function resolveModel({ capability, model } = {}) {
  const list = pickModels(capability);
  if (!model) return list[0];
  const found = list.find((m) => m.id === model || m.endpoint === model);
  if (!found) {
    throw new Error(
      `모델 '${model}' 은 능력 '${capability}' 에 없다. ` +
        `이 능력의 모델 ${list.length}개 중 예: ${list.slice(0, 3).map((m) => m.id).join(", ")}`,
    );
  }
  return found;
}

/** 생성 요청 한 건의 모양. 네트워크를 타지 않아 테스트가 계약을 고정할 수 있다. */
export function buildRequest({ endpoint, prompt, key, inputs = {} }) {
  if (!endpoint) throw new Error("endpoint 가 없다 — 카탈로그에서 모델을 먼저 고른다");
  return {
    url: `${BASE}/${endpoint}`,
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, ...inputs }),
  };
}

/** 결과 조회 URL. */
export function resultUrl(requestId) {
  return `${BASE}/predictions/${requestId}/result`;
}
