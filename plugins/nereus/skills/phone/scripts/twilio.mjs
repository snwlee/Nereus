// Twilio REST 호출(표준 fetch). 기존 Japan2026/tools/aicall/lib.mjs 를 옮겼다.

const API = "https://api.twilio.com/2010-04-01";

const authHeader = (env) =>
  "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

export async function request(env, method, url, form) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: authHeader(env), "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${res.status} ${body.code || ""} ${body.message || ""}`.trim());
  return body;
}

// 계정 하위 경로(`/Calls.json` 등)
export const twilio = (env, method, path, form) =>
  request(env, method, `${API}/Accounts/${env.TWILIO_ACCOUNT_SID}${path}`, form);

export const hangup = (env, callSid) => twilio(env, "POST", `/Calls/${callSid}.json`, { Status: "completed" });

export const fetchProfiles = (env) => request(env, "GET", "https://trusthub.twilio.com/v1/CustomerProfiles");
export const fetchBalance = (env) => twilio(env, "GET", "/Balance.json");
export const fetchGeo = (env, iso) =>
  request(env, "GET", `https://voice.twilio.com/v1/DialingPermissions/Countries?IsoCode=${encodeURIComponent(iso)}`);
