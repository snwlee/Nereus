// 외부 CLI 실행. shell 없이 spawn, Windows는 PATHEXT로 확장자 해석.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function resolveExecutable(cmd, opts = {}) {
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  const exists = opts.exists ?? ((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  const p = opts.pathMod ?? path;
  const isWin = platform === "win32";
  if (cmd.includes("/") || cmd.includes("\\")) return exists(cmd) ? cmd : null;
  const pathVar = env.PATH ?? env.Path ?? env.path ?? "";
  const dirs = pathVar.split(isWin ? ";" : ":").filter(Boolean);
  const exts = isWin ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  const hasExt = isWin && p.extname(cmd) !== "";
  for (const dir of dirs) {
    const candidates = hasExt ? [cmd] : isWin ? [cmd, ...exts.map((e) => cmd + e)] : [cmd];
    for (const c of candidates) {
      const full = p.join(dir, c);
      if (exists(full)) return full;
    }
  }
  return null;
}

export const which = resolveExecutable;

export function run(cmd, args = [], opts = {}) {
  const bin = resolveExecutable(cmd, opts);
  if (!bin) return { ok: false, status: null, stdout: "", stderr: `not found: ${cmd}` };
  const r = spawnSync(bin, args, { encoding: "utf8", shell: false, timeout: opts.timeoutMs ?? 60000, cwd: opts.cwd, env: opts.env ?? process.env, input: opts.input });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error) : "") };
}
