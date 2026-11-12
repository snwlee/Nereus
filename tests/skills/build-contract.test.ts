import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { recordEvidence } from "../../plugins/nereus/hooks/scripts/lib/evidence.mjs";

// 스펙: openspec/changes/2026-11-12-add-build-runtime-contract (skill-runtime-contract)
// 출처: NVIDIA/auto-ontology skills/*/assets/runtime-contract.yaml (Apache-2.0) — 키 구성만 따른다.

const PLUGIN = "plugins/nereus";
const SKILL_MD = `${PLUGIN}/skills/build/SKILL.md`;
const CONTRACT = `${PLUGIN}/skills/build/assets/runtime-contract.json`;

const TOP_KEYS = [
  "schema_version", "skill", "source", "workflows", "artifacts",
  "required_fields", "statuses", "gates", "handoffs",
];
const MIN_CHECK_LENGTH = 5;
const HANDOFF = /^nereus:([a-z0-9-]+)$/;

type Env = { skillMd: string; exists: (pluginRel: string) => boolean; evidenceKeys: string[] };

function checkContract(c: any, env: Env): string[] {
  const errors: string[] = [];
  const keys = Object.keys(c ?? {}).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...TOP_KEYS].sort())) {
    return [`최상위 키가 다르다: ${keys.join(",")}`];
  }
  if (c.skill !== "build") errors.push(`skill 이 build 가 아니다: ${c.skill}`);
  if (c.schema_version !== 1) errors.push(`schema_version 이 1 이 아니다: ${c.schema_version}`);

  const declared = new Set(Object.keys(c.artifacts));
  for (const [name, wf] of Object.entries<any>(c.workflows)) {
    for (const a of [...wf.input, ...wf.output]) {
      if (!declared.has(a)) errors.push(`workflow ${name}: 선언하지 않은 산출물 ${a}`);
    }
  }
  for (const a of Object.keys(c.required_fields)) {
    if (!declared.has(a)) errors.push(`required_fields: 선언하지 않은 산출물 ${a}`);
  }
  for (const [name, a] of Object.entries<any>(c.artifacts)) {
    if (a.kind === "script" && !env.exists(a.path)) errors.push(`산출물 ${name}: 스크립트 없음 ${a.path}`);
  }
  for (const s of c.statuses) {
    if (!env.skillMd.includes(s)) errors.push(`상태 ${s}: SKILL.md 에 없다`);
  }
  for (const g of c.gates) {
    if (g.check.length < MIN_CHECK_LENGTH) errors.push(`게이트 ${g.id}: check 가 너무 짧다`);
    if (!env.skillMd.includes(g.check)) errors.push(`게이트 ${g.id}: SKILL.md 에 없는 문구`);
    if (g.script && !env.exists(g.script)) errors.push(`게이트 ${g.id}: 스크립트 없음 ${g.script}`);
  }
  for (const h of c.handoffs) {
    const m = HANDOFF.exec(h.to);
    if (!m) { errors.push(`handoff ${h.to}: nereus:<이름> 형태가 아니다`); continue; }
    if (!env.exists(`skills/${m[1]}/SKILL.md`)) errors.push(`handoff ${h.to}: 스킬 없음`);
    if (!env.skillMd.includes(h.to)) errors.push(`handoff ${h.to}: SKILL.md 가 언급하지 않는다`);
  }
  const want = [...(c.required_fields.EvidenceRecord ?? [])].sort();
  const got = [...env.evidenceKeys].sort();
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    errors.push(`EvidenceRecord 필드 불일치: 계약 ${want} / 코드 ${got}`);
  }
  return errors;
}

function realEnv(): Env {
  const rec = recordEvidence(".", { command: "x", exitCode: 0 }, { hash: () => "h", now: 1, writeFile: () => {} });
  return {
    skillMd: fs.readFileSync(SKILL_MD, "utf8"),
    exists: (p) => fs.existsSync(path.join(PLUGIN, p)),
    evidenceKeys: Object.keys(rec),
  };
}

function loadReal(): any {
  expect(fs.existsSync(CONTRACT), CONTRACT).toBe(true);
  return JSON.parse(fs.readFileSync(CONTRACT, "utf8"));
}

describe("build 런타임 계약", () => {
  it("SKILL.md 가 assets/runtime-contract.json 을 가리킨다", () => {
    expect(fs.readFileSync(SKILL_MD, "utf8")).toContain("assets/runtime-contract.json");
  });

  it("실제 계약은 오류가 없다", () => {
    expect(checkContract(loadReal(), realEnv())).toEqual([]);
  });

  it("출처를 밝힌다", () => {
    expect(loadReal().source).toMatchObject({ repo: "NVIDIA/auto-ontology", license: "Apache-2.0" });
  });

  const mutations: Array<[string, (c: any) => void]> = [
    ["gates 키 삭제", (c) => { delete c.gates; }],
    ["최상위 extra 키", (c) => { c.extra = 1; }],
    ["선언하지 않은 산출물", (c) => { c.workflows.gate.output.push("Ghost"); }],
    ["required_fields 에 미선언 산출물", (c) => { c.required_fields.Ghost = ["x"]; }],
    ["없는 스크립트 산출물", (c) => { c.artifacts.RunTests.path = "skills/build/scripts/nope.mjs"; }],
    ["없는 게이트 스크립트", (c) => { c.gates[1].script = "skills/build/scripts/nope.mjs"; }],
    ["SKILL.md 에 없는 게이트 문구", (c) => { c.gates[0].check = "SKILL.md 에 없는 문장"; }],
    ["없는 handoff 스킬", (c) => { c.handoffs[0].to = "nereus:no-such-skill"; }],
    ["접두사 없는 handoff", (c) => { c.handoffs[0].to = "debug"; }],
    ["SKILL.md 가 언급하지 않는 handoff", (c) => { c.handoffs[0].to = "nereus:pdf"; }],
    ["계약 쪽 evidence 필드 추가", (c) => { c.required_fields.EvidenceRecord.push("duration"); }],
  ];
  for (const [name, mutate] of mutations) {
    it(`음성: ${name}`, () => {
      const c = structuredClone(loadReal());
      mutate(c);
      expect(checkContract(c, realEnv()).length).toBeGreaterThan(0);
    });
  }

  it("음성: 코드 쪽 evidence 필드 추가", () => {
    const env = realEnv();
    expect(checkContract(loadReal(), { ...env, evidenceKeys: [...env.evidenceKeys, "duration"] }).length).toBeGreaterThan(0);
  });
});
