// 큐 목록 검증과 정점 정렬. 큐 = "t 초에 이 소리". 소리의 정점(peak)이 t 에 오도록 앞당겨 놓는다.
const GAIN_MIN = -40;
const GAIN_MAX = 6;
const SOURCES = ["id", "file", "url"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const NON_NEGATIVE_KNOBS = ["apex", "dur"];
const PITCH_RE = /^[A-G](#|b)?\d$/;

// 큐 url 은 Openverse 결과(공개 CDN)여야 한다. 로컬·사설·링크로컬(클라우드 메타데이터) 주소는 받지 않는다.
// DNS 로 사설 IP 를 가리키는 이름까지는 막지 않는다 — 이 CLI 는 사용자 기계에서 사용자가 쓴 큐로 돈다.
const PRIVATE_HOST = [
  /^localhost$/, /\.local$/, /\.internal$/,
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./,
  /^\[?(::1|::|f[cd][0-9a-f]{2}:.*|fe80:.*)\]?$/i,
];

export function urlProblem(raw) {
  let u;
  try { u = new URL(raw); } catch { return "url is not a valid URL"; }
  if (u.protocol !== "https:") return "url must start with https://";
  const host = u.hostname.toLowerCase();
  if (PRIVATE_HOST.some((re) => re.test(host))) return `url host is local or private: ${host}`;
  return null;
}

function checkCue(c) {
  if (!c || typeof c !== "object") return "cue must be an object";
  if (!Number.isFinite(c.t) || c.t < 0) return "t must be a number >= 0";
  const given = SOURCES.filter((k) => c[k]);
  if (given.length !== 1) return "exactly one of id, file, url is required";
  if (c.url) {
    const problem = urlProblem(String(c.url));
    if (problem) return problem;
  }
  const badKnob = NON_NEGATIVE_KNOBS.find((k) => c[k] !== undefined && (!Number.isFinite(c[k]) || c[k] < 0));
  if (badKnob) return `${badKnob} must be a number >= 0`;
  // 합성기 인자로 그대로 넘어간다 — "--dur" 같은 값이 옵션으로 읽히지 않게 형식을 고정한다.
  if (c.pitch !== undefined && !PITCH_RE.test(String(c.pitch))) return "pitch must be a note name like E6 or F#7";
  if (c.seed !== undefined && !(Number.isInteger(c.seed) && c.seed >= 0)) return "seed must be an integer >= 0";
  return null;
}

export function parseCues(json) {
  if (!Array.isArray(json)) return { cues: [], errors: [{ index: -1, reason: "cues must be an array" }] };
  const errors = [];
  const cues = [];
  json.forEach((c, index) => {
    const reason = checkCue(c);
    if (reason) return errors.push({ index, reason });
    const gain = Number.isFinite(c.gainDb) ? c.gainDb : 0;
    cues.push({ ...c, gainDb: clamp(gain, GAIN_MIN, GAIN_MAX) });
  });
  return { cues: [...cues].sort((a, b) => a.t - b.t), errors };
}

export function delayMs(t, peakSec) {
  return Math.max(0, Math.round((t - peakSec) * 1000));
}
