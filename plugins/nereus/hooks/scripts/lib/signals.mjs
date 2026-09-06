// 판정층. 관찰 로그에서 결정론적 신호 세 가지만 뽑아 "후보"를 만든다. LLM 호출 없음.
// 후보는 규칙이 아니다. 사용자가 /nereus:learn 으로 승인해야 규칙이 된다(one-skill-to-rule-them-all 의 승인 규율, CC BY 4.0).
export const REPEAT_THRESHOLD = 3;
export const EVIDENCE_MAX = 5;
const NEAR_MS = 10 * 60 * 1000;

const head = (sig) => String(sig ?? "").split(/\s+/).slice(0, 3).join(" ");

export function detectSignals(observations) {
  const obs = [...observations].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  const out = [];

  // (a) 같은 명령이 실패했다가 성공 — 그 사이에 고친 파일이 원인일 가능성이 높다
  const byCmd = new Map();
  for (const o of obs) {
    if (o.k !== "tool" || o.tool !== "Bash" || !o.sig) continue;
    if (!byCmd.has(o.sig)) byCmd.set(o.sig, []);
    byCmd.get(o.sig).push(o);
  }
  for (const [sig, runs] of byCmd) {
    const failIdx = runs.findIndex((r) => r.ok === false);
    if (failIdx === -1) continue;
    const fixed = runs.slice(failIdx).find((r) => r.ok === true);
    if (!fixed) continue;
    const between = obs.filter((o) => o.k === "tool" && o.file && o.t > runs[failIdx].t && o.t <= fixed.t).map((o) => o.file);
    out.push({ type: "fail_then_fix", key: `실패 후 통과: ${sig}`, evidence: [...new Set(between)].slice(0, EVIDENCE_MAX) });
  }

  // (b) 한 세션에서 반복된 명령 — 스크립트나 별칭으로 만들 후보
  const counts = new Map();
  for (const o of obs) {
    if (o.k !== "tool" || o.tool !== "Bash" || !o.sig) continue;
    counts.set(o.sig, (counts.get(o.sig) ?? 0) + 1);
  }
  for (const [sig, n] of counts) {
    if (n >= REPEAT_THRESHOLD) out.push({ type: "repeated_command", key: `반복 실행(${n}회): ${sig}`, evidence: [`세션에서 ${n}회`] });
  }

  // (c) 사용자 교정 직후의 편집 — 무엇을 되돌렸는지가 규칙의 재료다
  for (const o of obs) {
    if (o.k !== "correction") continue;
    const after = obs.filter((x) => x.k === "tool" && x.file && x.t >= o.t && x.t - o.t < NEAR_MS).map((x) => x.file);
    out.push({ type: "correction", key: o.excerpt, evidence: [...new Set(after)].slice(0, EVIDENCE_MAX) });
  }

  // 같은 key 중복 제거
  const seen = new Map();
  for (const c of out) {
    const prev = seen.get(c.key);
    if (prev) prev.evidence = [...new Set([...prev.evidence, ...c.evidence])].slice(0, EVIDENCE_MAX);
    else seen.set(c.key, { ...c });
  }
  return [...seen.values()];
}

export function nextId(existing) {
  const max = existing.reduce((m, e) => Math.max(m, parseInt(e.id, 10) || 0), 0);
  return String(max + 1).padStart(4, "0");
}

/** 기존 후보에 새 신호를 합친다. declined 는 건드리지 않는다. 입력은 변경하지 않는다. */
export function mergeCandidates(existing, found, { now = Date.now() } = {}) {
  const out = existing.map((e) => ({ ...e, evidence: [...(e.evidence ?? [])] }));
  for (const f of found) {
    const hit = out.find((e) => e.key === f.key && e.type === f.type);
    if (hit) {
      if (hit.status === "declined" || hit.status === "approved") continue;
      hit.hits = (hit.hits ?? 1) + 1;
      hit.evidence = [...new Set([...hit.evidence, ...(f.evidence ?? [])])].slice(0, EVIDENCE_MAX);
      hit.at = now;
    } else {
      out.push({ id: nextId(out), type: f.type, key: f.key, evidence: (f.evidence ?? []).slice(0, EVIDENCE_MAX), status: "open", hits: 1, at: now });
    }
  }
  return out;
}
