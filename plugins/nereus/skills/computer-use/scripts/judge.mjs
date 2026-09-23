// computer-use 통로·안전 판정. 순수 함수 — 바이너리를 부르지 않는다(실측은 probe.mjs).
//
// 통로는 가장 정확한 것부터 고른다:
//   cua    — Cua Driver: pid 지정 입력(포커스를 뺏지 않는다), 창 기준 좌표, AX 요소, verify_state
//   orca   — Orca computer-use: 접근성 트리 조작. 대화상자·OCR 은 못 본다
//   vision — 스크린샷 + 창 기준 좌표. AX 에 안 잡히는 Qt·웹뷰 화면
//   lume   — 격리 VM. needsIsolation 일 때만
// 건너뛴 통로마다 사유 코드를 싣는다 — 조용히 내려가면 권한 미부여가 영구히 묻힌다.
//
// 실패 사례(2026-09-24): 전역 포커스에 keystroke 를 쏘다 대상이 아닌 칸·앱에 입력이 들어갔다.
// 그래서 입력은 대상 확인·사람 부재·원격 아님이 모두 참일 때만 go 다.

export const HUMAN_ACTIVE_SECONDS = 30; // 이보다 최근에 사람이 입력했으면 경합한다

const RISKS = new Set(["read", "input", "irreversible"]);

const granted = (cua) =>
  cua?.permissions?.accessibility === "granted" && cua?.permissions?.screenRecording === "granted";

function pickLayer(probe, request, reasons) {
  if (request.needsIsolation) {
    if (probe.lume?.installed) return "lume";
    reasons.push("lume-missing");
    return "none";
  }
  if (!probe.cua?.installed) reasons.push("cua-missing");
  else if (granted(probe.cua)) return "cua";
  else reasons.push("cua-permission-unconfirmed");

  const orca = probe.orca;
  if (!orca?.installed) reasons.push("orca-missing");
  else if (orca.click) {
    if (request.targetKind === "dialog" && !orca.dialogs) reasons.push("orca-no-dialogs-use-vision");
    return "orca";
  } else reasons.push("orca-no-click");

  if (orca?.installed && orca.screenshot) return "vision";
  reasons.push("no-screenshot");
  return "none";
}

function safetyVerdict(probe, request, risk, reasons) {
  if (risk === "read") return "go";
  const blocks = [];
  if (!request.targetConfirmed) blocks.push("target-unconfirmed");
  if (request.remoteControl) blocks.push("remote-control-active");
  if (typeof probe.humanIdleSeconds === "number" && probe.humanIdleSeconds < HUMAN_ACTIVE_SECONDS) blocks.push("human-active");
  if (blocks.length) {
    reasons.push(...blocks);
    return "block";
  }
  if (risk === "irreversible" && !request.approved) {
    reasons.push("needs-approval");
    return "ask";
  }
  return "go";
}

export function judge(probe = {}, request = {}) {
  const reasons = [];
  let risk = request.risk;
  if (!RISKS.has(risk)) {
    reasons.push("risk-unknown");
    risk = "irreversible";
  }
  const layer = pickLayer(probe, request, reasons);
  const safety = safetyVerdict(probe, request, risk, reasons);
  let verdict = safety;
  if (layer === "none" && safety !== "block") verdict = request.needsIsolation ? "ask" : "block";
  return { layer, verdict, risk, reasons };
}
