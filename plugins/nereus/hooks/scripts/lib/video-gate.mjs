// 영상 게이트. 유료 생성 API 호출이 OpenMontage 파이프라인 밖에서 일어나면 막는다. 순수 판정.
// 존재 이유: 여러 씬짜리 영상을 스크립트로 직접 짜면서 승인 없이 유료 생성을 돌려 예산을 태운 일이 있었다.
// OpenMontage 는 장면별 비용을 보여주는 스토리보드 승인 게이트와 렌더 후 자기검토를 갖고 있다.
// 규칙: 유료 API 를 부르는 **배치 스크립트**는 OpenMontage 안에서만. 돈 한도는 lib/budget.mjs(사이트 잔액 기준)가 본다.
import path from "node:path";

export const VIDEO_GATE_DEFAULTS = Object.freeze({ enforce: "block" });

// 유료 생성 API 흔적. 조회 전용 엔드포인트까지 잡는 것은 감수한다 — 오버라이드로 푼다.
const PAID_RE = /higgsfield[_-]?client|api\.higgsfield|\bhf\.(subscribe|submit)\s*\(|api\.muapi\.ai|fal_client|queue\.fal\.run|fal\.run\/|@fal-ai\/|api\.klingai|klingai\.com\/|volces\.com|ark\.cn-beijing|api\.replicate\.com|replicate\.run\(|api\.runwayml|api\.lumalabs/i;

export function findPaidMarker(text) {
  const m = PAID_RE.exec(String(text ?? ""));
  return m ? m[0] : null;
}

/** 명령 앞머리의 `cd X &&` 를 따라간 실제 작업 디렉터리. */
export function effectiveCwd(command, cwd) {
  let dir = cwd;
  const re = /(?:^|&&|;)\s*cd\s+("[^"]+"|'[^']+'|[^\s;&|]+)\s*(?=&&|;)/g;
  let m;
  while ((m = re.exec(command))) dir = path.resolve(dir, m[1].replace(/^["']|["']$/g, ""));
  return dir;
}

/** python·node 로 실행되는 스크립트 파일 경로(절대). */
export function scriptTargets(command, cwd) {
  const dir = effectiveCwd(command, cwd);
  const out = [];
  const re = /(?:^|[\s;&|(])(?:[^\s;&|]*\/)?(?:python3?(?:\.\d+)?|node|uv\s+run|bun)\s+(?:-[\w-]+\s+)*("[^"]+\.(?:py|mjs|cjs|js)"|'[^']+\.(?:py|mjs|cjs|js)'|[^\s;&|]+\.(?:py|mjs|cjs|js))/g;
  let m;
  while ((m = re.exec(command))) out.push(path.resolve(dir, m[1].replace(/^["']|["']$/g, "")));
  return out;
}

// nereus:video 의 CLI. generate 만 유료 호출이고 summary·models 는 조회다.
const MUAPI_CLI_RE = /muapi-cli\.mjs["']?\s+(\w+)/;

const blocked = (config, reason) => config.enforce === "warn" ? { allow: true, warning: reason } : { allow: false, reason };

/**
 * @param {{command:string, cwd:string, readFile:(p:string)=>string, isOpenMontage:(dir:string)=>boolean,
 *          override:string|null, config?:object}} input
 * @returns {{allow:boolean, reason?:string, warning?:string, paid?:boolean, batch?:boolean, consumeOverride?:boolean}}
 */
export function videoGateVerdict({ command, cwd, readFile, isOpenMontage, override = null, config = VIDEO_GATE_DEFAULTS }) {
  const cfg = { ...VIDEO_GATE_DEFAULTS, ...(config ?? {}) };
  if (cfg.enforce === "off" || !command) return { allow: true };
  const dir = effectiveCwd(command, cwd);

  const cli = MUAPI_CLI_RE.exec(command);
  const inline = cli ? (cli[1] === "generate" ? "muapi-cli generate" : null) : findPaidMarker(command);
  const batch = cli ? null : scriptTargets(command, cwd).find((f) => { try { return findPaidMarker(readFile(f).slice(0, 400_000)); } catch { return false; } });
  if (!inline && !batch) return { allow: true };

  if (override) return { allow: true, consumeOverride: true };
  if (isOpenMontage(dir) || (batch && isOpenMontage(path.dirname(batch)))) return { allow: true, paid: true, batch: true }; // OpenMontage 안 유료 호출은 파이프라인 = 배치다. 비용 계획이 있어야 한다
  if (batch) {
    const how = "대규모 영상 제작(여러 씬·배치 생성)은 nereus:montage 절차대로 OpenMontage 파이프라인에서 진행하세요 — 장면별 비용 승인 게이트와 렌더 후 자기검토가 거기 있습니다. 사용자가 이번 한 번을 명시적으로 승인했다면 그 사유를 .nereus/video-gate-override 에 한 줄로 적고 다시 실행하세요(한 번 쓰면 사라집니다).";
    return blocked(cfg, `[nereus:video-gate] 유료 생성 API 를 부르는 배치 스크립트(${path.basename(batch)})를 OpenMontage 밖에서 실행하려 했습니다. ${how}`);
  }
  return { allow: true, paid: true, batch: false };
}
