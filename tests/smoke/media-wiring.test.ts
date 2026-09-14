import { describe, it, expect } from "vitest";
import fs from "node:fs";

const IMAGE = "plugins/nereus/skills/image/SKILL.md";
const VIDEO = "plugins/nereus/skills/video/SKILL.md";
const EXT = "plugins/nereus/nereus-extension.json";

describe("생성형 미디어 배선", () => {
  it("video 스킬이 존재하고 자기 클라이언트를 가리킨다", () => {
    expect(fs.existsSync(VIDEO)).toBe(true);
    expect(fs.readFileSync(VIDEO, "utf8")).toContain("muapi-client.mjs");
  });
  it("image 스킬이 유료 경로를 가리키되 무료 기본값을 유지한다", () => {
    const t = fs.readFileSync(IMAGE, "utf8");
    expect(t).toContain("muapi");
    // 무료 웹세션이 여전히 기본이어야 한다 — 유료를 기본으로 만들지 않는다
    expect(t).toMatch(/무료/);
  });
  it("두 스킬 모두 출처와 라이선스를 밝힌다", () => {
    for (const f of [IMAGE, VIDEO]) {
      const t = fs.readFileSync(f, "utf8");
      expect(t, f).toMatch(/Open-Generative-AI|muapi\.ai/i);
    }
  });
  it("모델 이름을 스킬 본문에 박지 않는다 — 카탈로그가 정한다", () => {
    const t = fs.readFileSync(VIDEO, "utf8");
    expect(t).toContain("muapi-catalog.mjs");
  });
  it("키 없이 무엇이 되고 무엇이 안 되는지 적는다", () => {
    expect(fs.readFileSync(VIDEO, "utf8")).toMatch(/MUAPI_API_KEY/);
  });
  it("코어 스킬 이름이 다섯 플러그인에서 겹치지 않는다", () => {
    const P = ["nereus", "nereus-game", "nereus-ads", "nereus-l10n", "nereus-3d"];
    const all = P.flatMap((p) => (fs.existsSync(`plugins/${p}/skills`) ? fs.readdirSync(`plugins/${p}/skills`) : []));
    expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
  });
});

describe("video 라우트", () => {
  const load = async () => (await import("../../plugins/nereus/hooks/scripts/lib/router.mjs")) as any;
  const hit = (mod: any, text: string) =>
    (mod.ROUTES ?? mod.routes ?? []).filter((r: any) => new RegExp(r.re).test(text)).map((r: any) => r.skill);

  it("영상 요청을 video 로 보낸다", async () => {
    const m = await load();
    for (const q of ["영상 만들어줘", "동영상 생성해", "립싱크 영상"]) {
      expect(hit(m, q), q).toContain("nereus:video");
    }
  });
  it("이미지 요청을 뺏지 않는다", async () => {
    const m = await load();
    for (const q of ["아이콘 만들어", "배너 이미지 만들어"]) {
      expect(hit(m, q), q).not.toContain("nereus:video");
      expect(hit(m, q), q).toContain("nereus:image");
    }
  });
});
