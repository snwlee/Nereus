// 이식보다 먼저 깐 검사. 1차에서 "선언했는데 실재하지 않음" 결함을 세 번 놓쳤고
// 세 번 다 단위 테스트는 초록이었다. 이식 분량이 커질수록 재발 확률이 올라간다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = "plugins/nereus-game";
const DOMAIN_SKILLS = ["level", "narrative", "gameux", "asset", "balance"];
const ENGINE_TOKENS = [/game\.Players/, /:GetService/, /MonoBehaviour/, /UnityEngine/];

describe("선언한 자산은 실재한다", () => {
  it("라우트가 가리키는 스킬이 전부 있다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    for (const r of ext.routes) {
      const name = r.skill.split(":")[1];
      expect(fs.existsSync(`${ROOT}/skills/${name}/SKILL.md`), r.skill).toBe(true);
    }
  });

  it("도메인 스킬 5종이 존재한다", () => {
    for (const s of DOMAIN_SKILLS) {
      expect(fs.existsSync(`${ROOT}/skills/${s}/SKILL.md`), s).toBe(true);
    }
  });

  it("프로파일이 최소 2종 있고 필수 키를 갖는다", () => {
    const dir = `${ROOT}/profiles`;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const key of ["genre", "loop", "metrics", "balance"]) {
        expect(p[key], `${f}:${key}`).toBeDefined();
      }
    }
  });
});

describe("도메인 스킬은 엔진을 모른다", () => {
  it("엔진 고유 토큰이 없다", () => {
    for (const s of DOMAIN_SKILLS) {
      const text = fs.readFileSync(`${ROOT}/skills/${s}/SKILL.md`, "utf8");
      for (const re of ENGINE_TOKENS) {
        expect(re.test(text), `${s} 에 ${re}`).toBe(false);
      }
    }
  });
});
