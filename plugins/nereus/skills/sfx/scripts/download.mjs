// URL 큐 다운로드 — 스트리밍으로 받으며 상한을 넘는 순간 끊는다. 다 받은 뒤에 재면 큰 응답이 메모리를 먼저 채운다.
import { createWriteStream, rmSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { urlProblem } from "./cues.mjs";

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 60000;
const MAX_REDIRECTS = 5;

// 리다이렉트를 직접 따라간다 — 자동으로 따라가면 https 공개 주소에서 http·내부 주소로 내려가도 모른다.
async function fetchFollowing(url, { fetchImpl, timeoutMs }) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const problem = urlProblem(current);
    if (problem) throw new Error(`download refused: ${problem}`);
    const res = await fetchImpl(current, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    const location = res.status >= 300 && res.status < 400 ? res.headers?.get?.("location") : null;
    if (!location) {
      if (!res.ok) throw new Error(`download ${res.status}: ${current}`);
      return res;
    }
    current = new URL(location, current).toString();
  }
  throw new Error(`download: too many redirects (> ${MAX_REDIRECTS}): ${url}`);
}

export async function downloadTo(url, dest, { fetchImpl = fetch, maxBytes = MAX_DOWNLOAD_BYTES, timeoutMs = TIMEOUT_MS } = {}) {
  const res = await fetchFollowing(url, { fetchImpl, timeoutMs });
  const declared = Number(res.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`download too large (${declared} bytes > ${maxBytes}): ${url}`);
  let seen = 0;
  const limit = async function* (source) {
    for await (const chunk of source) {
      seen += chunk.length;
      if (seen > maxBytes) throw new Error(`download too large (> ${maxBytes} bytes): ${url}`);
      yield chunk;
    }
  };
  try {
    await pipeline(Readable.fromWeb(res.body), limit, createWriteStream(dest));
  } catch (err) {
    rmSync(dest, { force: true });
    throw err;
  }
}
