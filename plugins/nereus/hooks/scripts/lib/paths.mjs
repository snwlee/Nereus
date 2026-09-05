// 설정·상태 경로. 플랫폼 분기는 여기서만 한다.
import path from "node:path";
import os from "node:os";

const APP = "nereus";

export function userConfigDir(opts = {}) {
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  const home = opts.home ?? os.homedir();
  if (env.NEREUS_HOME) return env.NEREUS_HOME;
  if (platform === "win32") {
    const base = env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(base, APP);
  }
  return path.join(home, ".config", APP);
}

export function projectStateDir(cwd) {
  return path.join(cwd, ".nereus");
}

export function handoffPath(cwd) {
  return path.join(projectStateDir(cwd), "handoff.md");
}
