// phone 준비·요청 판정. 순수 함수 — 네트워크를 부르지 않는다(실측은 probe.mjs).
//
// 실패 사례(2026-09-25 Japan2026): 발신하고 나서야 Twilio 401 20003(KYC 프로필 미승인)을 알았다.
// 그래서 발신 전에 준비 상태(env·KYC·잔액·중계)를 모두 보고, 문제는 한 번에 전부 사유로 싣는다.
// 발신은 외부로 나가는 행동이다 — 모든 검사를 통과해도 사용자 승인이 없으면 ask 다.

export const MIN_BALANCE_USD = 2;        // 10분 국제 통화 + Realtime 이면 이 정도는 남아 있어야 한다
export const MAX_CALL_SEC = 600;         // 비용 상한: Twilio TimeLimit
export const DEFAULT_HOURS = Object.freeze({ start: 9, end: 20 });   // 상대 현지 시각, end 는 미포함

export const DISCLOSURE_TAG = "[AI-DISCLOSURE]";

// 국가 코드 → ISO·시간대. 긴 접두어부터 맞춘다(+852 가 +8 계열보다 먼저).
const COUNTRIES = Object.freeze([
  ["852", "HK", "Asia/Hong_Kong"],
  ["886", "TW", "Asia/Taipei"],
  ["81", "JP", "Asia/Tokyo"],
  ["82", "KR", "Asia/Seoul"],
  ["86", "CN", "Asia/Shanghai"],
  ["65", "SG", "Asia/Singapore"],
  ["66", "TH", "Asia/Bangkok"],
  ["84", "VN", "Asia/Ho_Chi_Minh"],
  ["63", "PH", "Asia/Manila"],
  ["61", "AU", "Australia/Sydney"],
  ["44", "GB", "Europe/London"],
  ["33", "FR", "Europe/Paris"],
  ["49", "DE", "Europe/Berlin"],
  ["1", "US", "America/New_York"],
].sort((a, b) => b[0].length - a[0].length));

const E164 = /^\+\d{8,15}$/;
const CARD_LIKE = /(?:\d[ -]?){13,19}/;   // 카드번호처럼 보이는 13~19자리
// 비밀번호·PIN·인증번호·여권 뒤에 값이 붙은 것(보안 리뷰 L14). 규칙 문장의 "card or payment details" 는 값이 없어 안 걸린다.
const SECRET_LIKE = /(\b(password|passwd|pin|passport|otp)\b|パスワード|暗証番号|認証コード|비밀번호|인증번호|여권\s?번호)\s*(?:[:：=]|は|는|은)?\s*[A-Za-z0-9]{3,}/i;

export function countryOf(e164) {
  const digits = String(e164 || "").replace(/^\+/, "");
  const hit = COUNTRIES.find(([code]) => digits.startsWith(code));
  return hit ? { iso: hit[1], tz: hit[2] } : null;
}

function readinessReasons(probe) {
  const reasons = [];
  if (probe.envMissing?.length) reasons.push("env-missing");
  if (probe.kyc !== "twilio-approved") reasons.push("kyc-not-approved");
  if (!(probe.balanceUsd >= MIN_BALANCE_USD)) reasons.push("balance-low");
  if (!probe.relayLocal) reasons.push("relay-local-down");
  if (!probe.relayPublic) reasons.push("relay-public-down");
  return reasons;
}

function numberReasons(to, geo) {
  if (!E164.test(to || "")) return ["bad-number"];
  const c = countryOf(to);
  if (!c) return ["country-unknown"];
  return (geo || []).includes(c.iso) ? [] : ["geo-blocked"];
}

function jobReasons(job) {
  const reasons = [];
  const text = String(job?.instructions || "");
  if (!text.includes(DISCLOSURE_TAG)) reasons.push("disclosure-missing");
  if (CARD_LIKE.test(text) || SECRET_LIKE.test(text)) reasons.push("secret-in-job");
  if (!(job?.timeLimitSec > 0) || job.timeLimitSec > MAX_CALL_SEC) reasons.push("time-limit-too-long");
  return reasons;
}

function hourReasons(localHour, hours = DEFAULT_HOURS) {
  const ok = Number.isInteger(localHour) && localHour >= hours.start && localHour < hours.end;
  return ok ? [] : ["outside-call-hours"];
}

export function judge(probe, request) {
  const risk = request?.risk;
  if (risk !== "read" && risk !== "call") return { verdict: "block", reasons: ["unknown-risk"] };

  const ready = readinessReasons(probe || {});
  if (risk === "read") return { verdict: "go", reasons: ready };

  const reasons = [
    ...ready,
    ...numberReasons(request.to, probe?.geo),
    ...jobReasons(request.job),
    ...hourReasons(request.localHour, request.job?.hours),
  ];
  if (reasons.length) return { verdict: "block", reasons };
  if (!request.approved) return { verdict: "ask", reasons: ["needs-approval"] };
  return { verdict: "go", reasons: [] };
}
