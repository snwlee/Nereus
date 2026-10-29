// SOUNDS.md — 쓴 소리마다 출처·라이선스·표기. CC-BY 를 표기 없이 쓰지 않는다.
import { classifyLicense } from "./license.mjs";

export const SYNTH_NOTICE = "Synthesized with earshot-sfx-lite (MIT, © 2026 Leon Lin) — https://github.com/Dodai0419/earshot-sfx-lite";

const cell = (v) => String(v ?? "").replace(/\|/g, "\\|");

export function renderSoundsMd(entries) {
  const rows = entries.map((e) => {
    const { verdict, license } = classifyLicense(e.license);
    if (verdict === "block") throw new Error(`blocked license: ${license || "(none)"} for ${e.sound}`);
    if (verdict === "credit" && !String(e.attribution ?? "").trim()) throw new Error(`attribution required for ${e.sound} (${license})`);
    return `| ${cell(e.t)} | ${cell(e.sound)} | ${cell(e.source)} | ${cell(license)} | ${cell(e.attribution)} |`;
  });
  const hasSynth = entries.some((e) => classifyLicense(e.license).license === "synth");
  return [
    "# Sounds", "",
    "| t | sound | source | license | credit |",
    "|---|---|---|---|---|",
    ...rows,
    ...(hasSynth ? ["", SYNTH_NOTICE] : []),
    "",
  ].join("\n");
}
