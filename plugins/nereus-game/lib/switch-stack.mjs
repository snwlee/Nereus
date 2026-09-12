// Nintendo Switch 대상 판정.
//
// **빌드 명령을 저장소에 적지 않는다.** NintendoSDK 문서가 NDA 라 공개 저장소에 담을 수 없다.
// 설정에서 읽고, 없으면 null 을 돌려 게이트를 켜지 않는다 — 명령을 지어내지 않는다.
import fs from "node:fs";
import path from "node:path";

const defaultFs = { exists: (p) => fs.existsSync(p) };

export const SWITCH_ZONE = "Platform/Switch";

export function isSwitchTarget(cwd, fsx = defaultFs) {
  return fsx.exists(path.join(cwd, SWITCH_ZONE));
}

/** @returns {{ command: string } | null} */
export function detectSwitchBuild(cwd, fsx = defaultFs, config = {}) {
  if (!isSwitchTarget(cwd, fsx)) return null;
  const command = config?.switch?.build;
  return typeof command === "string" && command ? { command } : null;
}
