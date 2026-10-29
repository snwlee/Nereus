// Openverse 오디오 검색 — 키 없음(익명 20/분·200/일). 효과음은 사실상 Freesound 미러이고 받는 파일은 프리뷰 MP3 다.
// category=sound_effect 는 싣지 않는다: Freesound 항목의 category 가 null 이라 붙이면 0 건이 된다(2026-10-30 실측).
import { classifyLicense } from "./license.mjs";

const ENDPOINT = "https://api.openverse.org/v1/audio/";
const MAX_PAGE = 20;
const DEFAULT_PAGE = 10;

export function buildSearchUrl({ q, pageSize = DEFAULT_PAGE }) {
  const u = new URL(ENDPOINT);
  u.searchParams.set("q", String(q));
  u.searchParams.set("license", "cc0,pdm");
  u.searchParams.set("page_size", String(Math.min(MAX_PAGE, Math.max(1, Math.trunc(pageSize) || DEFAULT_PAGE))));
  return u.toString();
}

export function parseResults(json) {
  return (json?.results ?? [])
    .filter((r) => r?.url && classifyLicense(r.license).verdict !== "block")
    .map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      license: classifyLicense(r.license).license,
      attribution: r.attribution ?? "",
      durationSec: Number.isFinite(r.duration) ? r.duration / 1000 : null,
      source: r.source,
      filetype: r.filetype,
    }));
}

// Openverse 는 가끔 500 을 내거나 응답 없이 매달린다(2026-10-30 실측: 같은 요청이 500 → 200, 다음 요청은 무응답).
// 5xx 만 한 번 재시도하고, 요청마다 타임아웃을 건다. 4xx(한도·인증)는 재시도해도 같으니 바로 낸다.
const TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function search(q, { fetchImpl = fetch, pageSize, timeoutMs = TIMEOUT_MS, retryDelayMs = RETRY_DELAY_MS } = {}) {
  const url = buildSearchUrl({ q, pageSize });
  const attempt = () => fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  let res = await attempt();
  if (res.status >= 500) {
    await sleep(retryDelayMs);
    res = await attempt();
  }
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error(`openverse: invalid JSON (${err.message})`);
  }
  return parseResults(json);
}
