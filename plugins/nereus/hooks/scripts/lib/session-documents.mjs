import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { projectStateDir } from "./paths.mjs";

const WORK_TASK = /^(?:(?:openspec\/changes\/(?!archive\/)|(?:\.specify\/)?specs\/)[^/]+\/tasks\.md|tasks\.md|TASKS\.md|docs\/tasks\.md)$/;

const workDir = (cwd) => path.join(projectStateDir(cwd), "session-work");

function prepareWorkDir(cwd) {
  const dir = workDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, ".gitignore"), "*\n", { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return dir;
}

export function sessionStateDir(cwd, sessionId) {
  if (!sessionId) return projectStateDir(cwd);
  cwd = checkoutRoot(cwd);
  const key = createHash("sha256").update(sessionId).digest("hex");
  return path.join(workDir(cwd), "sessions", key);
}

export function prepareSessionState(cwd, sessionId) {
  const dir = sessionStateDir(cwd, sessionId);
  if (sessionId) prepareWorkDir(checkoutRoot(cwd));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function canonical(file) {
  try {
    return fs.realpathSync(file);
  } catch (error) {
    if (error.code !== "ENOENT" || path.dirname(file) === file) throw error;
    return path.join(canonical(path.dirname(file)), path.basename(file));
  }
}

export function checkoutRoot(cwd) {
  const start = canonical(path.resolve(cwd));
  let project;
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (!project && [".nereus", "openspec", ".specify", "specs"].some((marker) => fs.existsSync(path.join(dir, marker)))) {
      project = dir;
    }
    if (path.dirname(dir) === dir) return project ?? start;
  }
}

const relative = (cwd, file) =>
  path.relative(canonical(cwd), canonical(path.resolve(cwd, file))).split(path.sep).join("/");

export function isWorkflowTask(cwd, file) {
  return WORK_TASK.test(relative(checkoutRoot(cwd), path.resolve(cwd, file)));
}

function workUnit(tasks) {
  return tasks.endsWith("/tasks.md") && tasks !== "docs/tasks.md"
    ? tasks.slice(0, -"/tasks.md".length)
    : tasks;
}

const registryFile = (cwd) => path.join(workDir(cwd), "claims.json");

const archiveFile = (cwd) => path.join(workDir(cwd), "archive.json");

function readOptional(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return fallback;
  }
}

const readClaims = (cwd) => readOptional(registryFile(cwd), []);

function withWorkLock(cwd, action) {
  const lock = path.join(prepareWorkDir(cwd), "registry.lock");
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; ; attempt++) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (attempt === 100) throw new Error("Nereus 작업 등록이 진행 중입니다. 잠시 후 다시 시도하세요.");
      Atomics.wait(wait, 0, 0, 10);
    }
  }
  try {
    return action(lock);
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

function publish(lock, file, state) {
  const temp = path.join(lock, "state.json");
  fs.writeFileSync(temp, JSON.stringify(state, null, 2) + "\n");
  fs.renameSync(temp, file);
}

export function archiveTransaction(cwd, sessionId, archive) {
  if (!sessionId || sessionId === "nosession") throw new Error("현재 세션 ID가 필요합니다.");
  const root = checkoutRoot(cwd);
  const file = archiveFile(root);
  withWorkLock(root, (lock) => {
    const active = readOptional(file, null);
    if (active) throw new Error(`세션 ${active.sessionId}의 OpenSpec archive 또는 커밋이 진행 중입니다.`);
    publish(lock, file, { sessionId, running: true });
  });
  try {
    archive(root);
  } catch (error) {
    withWorkLock(root, () => fs.unlinkSync(file));
    throw error;
  }
  withWorkLock(root, (lock) => publish(lock, file, { sessionId, running: false }));
}

function updateClaims(cwd, update) {
  return withWorkLock(cwd, (lock) => {
    const { claims, result, afterWrite } = update(readClaims(cwd));
    publish(lock, registryFile(cwd), claims);
    afterWrite?.();
    return result;
  });
}

export function claimedTasks(cwd, sessionId) {
  return readClaims(checkoutRoot(cwd)).find((claim) => claim.sessionId === sessionId)?.tasks ?? null;
}

export function claimWork(cwd, sessionId, file) {
  if (!sessionId || sessionId === "nosession") throw new Error("현재 세션 ID가 필요합니다.");
  const root = checkoutRoot(cwd);
  if (!file) throw new Error("작업 단위의 tasks.md 경로를 지정하세요.");
  const tasks = relative(root, path.resolve(cwd, file));
  if (!WORK_TASK.test(tasks)) throw new Error("작업 단위의 tasks.md 경로를 지정하세요.");
  return updateClaims(root, (claims) => {
    const owner = claims.find((claim) => claim.tasks === tasks);
    if (owner && owner.sessionId !== sessionId) {
      throw new Error(`${tasks}는 세션 ${owner.sessionId}에서 작업 중입니다.`);
    }
    const current = claims.find((claim) => claim.sessionId === sessionId);
    if (current && current.tasks !== tasks) {
      throw new Error(`현재 세션은 ${current.tasks}를 사용 중입니다. 먼저 release 하세요.`);
    }
    return { claims: owner ? claims : [...claims, { tasks, sessionId }], result: tasks };
  });
}

export function releaseWork(cwd, sessionId) {
  if (!sessionId || sessionId === "nosession") throw new Error("현재 세션 ID가 필요합니다.");
  const root = checkoutRoot(cwd);
  updateClaims(root, (claims) => {
    const archive = readOptional(archiveFile(root), null);
    const ownsArchive = archive?.sessionId === sessionId;
    if (ownsArchive && archive.running) throw new Error("OpenSpec archive 실행 중에는 작업 등록을 해제할 수 없습니다.");
    return {
      claims: claims.filter((claim) => claim.sessionId !== sessionId),
      afterWrite: ownsArchive ? () => fs.unlinkSync(archiveFile(root)) : undefined,
    };
  });
}

export function documentConflict(cwd, sessionId, files, loopOwner) {
  if (!files.length) return null;
  const root = checkoutRoot(cwd);
  const others = readClaims(root).filter((claim) => claim.sessionId !== sessionId && claim.sessionId !== loopOwner);
  const ownDir = relative(root, sessionStateDir(root, sessionId));
  const sessions = relative(root, path.join(workDir(root), "sessions"));
  const archive = readOptional(archiveFile(root), null);
  for (const file of files) {
    const rel = relative(root, path.resolve(cwd, file));
    if (rel.startsWith(sessions + "/") && (!sessionId || !rel.startsWith(ownDir + "/"))) {
      return `${rel}는 다른 세션의 작업 기록입니다.`;
    }
    if (archive && archive.sessionId !== sessionId && rel.startsWith("openspec/specs/")) {
      return `${rel}는 세션 ${archive.sessionId}의 OpenSpec archive 또는 커밋 작업에 포함됩니다.`;
    }
    const owner = others.find(({ tasks }) => {
      const unit = workUnit(tasks);
      return rel === unit || rel.startsWith(unit + "/");
    });
    if (owner) return `${rel}는 세션 ${owner.sessionId}에서 작업 중입니다.`;
  }
  return null;
}
