// 에셋 파이프라인 단계별 전제 판정.
//
// **설치를 시도하지 않는다. 판정하고 알린다.**
// 도구 부재는 결함이 아니라 상태다 — 예외를 던지면 전제가 없는 환경에서 파이프라인 전체가 멈춘다.
// 알아야 할 정보는 "무엇이 없어서 어느 단계가 막히는가" 하나다.
import { spawnSync } from "node:child_process";

const defaultWhich = (cmd) =>
  spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" }).status === 0;

const STAGES = [
  {
    stage: "3d",
    label: "3D 생성 → Blender 경유 → 엔진",
    check: ({ which }) => which("blender"),
    why: "blender 가 PATH 에 없다. 3D 생성물은 리토폴로지·UV·스케일 정규화 없이 엔진에 넣을 수 없다",
  },
  {
    stage: "2d",
    label: "2D 생성(ComfyUI 고정 워크플로) → 후처리",
    check: ({ env }) => Boolean(env.COMFYUI_URL),
    why: "COMFYUI_URL 이 없다. 워크플로를 고정해 결정론적으로 재생성할 경로가 없다",
  },
  {
    stage: "audio",
    label: "보이스·SFX(ElevenLabs) · BGM(YuE)",
    check: ({ env }) => Boolean(env.ELEVENLABS_API_KEY),
    why: "ELEVENLABS_API_KEY 가 없다. 자리표시자 오디오로 진행하고 교체 지점을 태스크로 남긴다",
  },
];

/** @returns {Array<{stage:string,label:string,ok:boolean,why:string}>} */
export function assetDoctor(deps = {}) {
  const which = deps.which ?? defaultWhich;
  const env = deps.env ?? process.env;
  return STAGES.map((s) => {
    let ok = false;
    try {
      ok = Boolean(s.check({ which, env }));
    } catch {
      ok = false; // 판정 실패는 "가용하지 않음"이다. 던지지 않는다
    }
    return { stage: s.stage, label: s.label, ok, why: ok ? "" : s.why };
  });
}

// 실행 진입점. 스킬이 `node lib/asset-doctor.mjs` 로 부른다. 부재는 결함이 아니므로 항상 0 으로 끝낸다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  for (const s of assetDoctor()) {
    process.stdout.write(`${s.ok ? "OK  " : "--  "} ${s.stage.padEnd(6)} ${s.ok ? s.label : s.why}\n`);
  }
  process.exit(0);
}
