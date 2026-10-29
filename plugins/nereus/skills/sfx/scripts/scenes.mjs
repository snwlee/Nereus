// ffmpeg scene 검출 출력 → 효과음 후보 시각. 후보일 뿐 — 무엇을 어디에 둘지는 사람이(또는 Claude 가) 정한다.
const DEFAULT_GAP_SEC = 0.25;
const DEFAULT_THRESHOLD = 0.3;

export function parseSceneTimes(stderr, { minGapSec = DEFAULT_GAP_SEC } = {}) {
  const times = [...String(stderr).matchAll(/pts_time:([0-9.]+)/g)]
    .map((m) => Number(m[1]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const kept = times.reduce((acc, t) => (acc.length && t - acc.at(-1) < minGapSec ? acc : [...acc, t]), []);
  return kept.map((t) => Math.round(t * 1000) / 1000);
}

export function sceneArgs(video, threshold = DEFAULT_THRESHOLD) {
  // -vf 문자열로 들어간다 — 0~1 숫자만.
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) throw new Error(`threshold must be a number in (0, 1): ${threshold}`);
  return ["-hide_banner", "-i", video, "-vf", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"];
}
