#!/usr/bin/env node
// computer-use 실측 probe. 설치·권한·사람 유휴 시간을 재서 judge 에 넘기고 결과 JSON 을 낸다.
//   node probe.mjs [--risk read|input|irreversible] [--target-confirmed] [--remote] [--approved]
//                  [--isolation] [--target-kind window|dialog]
// 파서는 순수 함수이고 실측 출력 픽스처로 검증한다(tests/fixtures/computer-use).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { judge } from "./judge.mjs";

const UNKNOWN = Object.freeze({ accessibility: "unknown", screenRecording: "unknown" });

const tryJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// 권한 값을 granted / denied / unknown 셋으로만 낸다. 모르는 형식은 unknown — 단정하지 않는다.
const permValue = (v) => {
  if (v === true || v === "granted" || v === "authorized") return "granted";
  if (v === false || v === "denied" || v === "not_granted") return "denied";
  return "unknown";
};

const findKey = (obj, re) => {
  if (!obj || typeof obj !== "object") return undefined;
  const key = Object.keys(obj).find((k) => re.test(k));
  return key === undefined ? undefined : obj[key];
};

// `cua-driver permissions status --json`. 데몬이 없으면 {"daemon_running": false, "status": "unknown"}.
// 허용 상태의 실측 형식은 권한 부여 뒤에 픽스처로 추가한다 — 그 전까지 키 이름은 너그럽게 읽는다.
export function parseCuaPermissions(text) {
  const d = tryJson(text);
  if (!d || d.daemon_running === false || d.status === "unknown") return { ...UNKNOWN };
  const src = d.permissions ?? d;
  return {
    accessibility: permValue(findKey(src, /^access/i)),
    screenRecording: permValue(findKey(src, /screen/i)),
  };
}

// `orca computer capabilities --json`
export function parseOrcaCapabilities(text) {
  const d = tryJson(text);
  const s = d?.ok ? d.result?.supports : null;
  if (!s) return { installed: false, click: false, screenshot: false, dialogs: false };
  return {
    installed: true,
    click: Boolean(s.actions?.click),
    screenshot: Boolean(s.observation?.screenshot),
    dialogs: Boolean(s.surfaces?.dialogs),
  };
}

// `ioreg -c IOHIDSystem` 의 "HIDIdleTime" = <나노초>. 마지막 사람 입력 뒤 경과 초.
export function parseHidIdle(text) {
  const m = /"HIDIdleTime"\s*=\s*(\d+)/.exec(String(text));
  return m ? Number(m[1]) / 1e9 : null;
}

export function parseArgs(argv) {
  const args = { risk: "read", targetConfirmed: false, remoteControl: false, approved: false, needsIsolation: false, targetKind: "window" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--risk") args.risk = argv[++i];
    else if (a === "--target-kind") args.targetKind = argv[++i];
    else if (a === "--target-confirmed") args.targetConfirmed = true;
    else if (a === "--remote") args.remoteControl = true;
    else if (a === "--approved") args.approved = true;
    else if (a === "--isolation") args.needsIsolation = true;
  }
  return args;
}

const run = (cmd, argv) => {
  try {
    return execFileSync(cmd, argv, { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    return e?.stdout ? String(e.stdout) : null;
  }
};

const resolveBin = (name, extra = []) => {
  for (const p of extra) if (existsSync(p)) return p;
  const found = run("/usr/bin/which", [name]);
  return found ? found.trim() : null;
};

export function probeHost() {
  const cuaBin = resolveBin("cua-driver", [join(homedir(), ".local/bin/cua-driver")]);
  const orcaBin = process.env.ORCA_CLI_COMMAND || resolveBin("orca");
  const cuaVersion = cuaBin ? run(cuaBin, ["--version"])?.trim() ?? null : null;
  return {
    platform: platform(),
    cua: cuaBin
      ? { installed: true, bin: cuaBin, version: cuaVersion, permissions: parseCuaPermissions(run(cuaBin, ["permissions", "status", "--json"]) ?? "") }
      : { installed: false },
    orca: orcaBin ? { bin: orcaBin, ...parseOrcaCapabilities(run(orcaBin, ["computer", "capabilities", "--json"]) ?? "") } : { installed: false },
    lume: { installed: Boolean(resolveBin("lume", [join(homedir(), ".local/bin/lume")])) },
    humanIdleSeconds: platform() === "darwin" ? parseHidIdle(run("/usr/sbin/ioreg", ["-c", "IOHIDSystem"]) ?? "") : null,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const request = parseArgs(process.argv.slice(2));
  const probe = probeHost();
  console.log(JSON.stringify({ probe, request, ...judge(probe, request) }, null, 2));
}
