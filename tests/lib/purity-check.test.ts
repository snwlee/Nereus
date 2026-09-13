// 제작 층. roblox·unity 스킬이 "로직을 엔진에서 떼어내는 설계가 곧 1단 커버리지"라고
// 적어놓고 떼는 방법을 비워두었다. ToonTone test/architecture_test.dart 에서 채굴했다.
import { describe, it, expect } from "vitest";
import { loadLayers, checkPurity } from "../../plugins/nereus-game/lib/purity-check.mjs";

describe("layers.json — 경계는 데이터다", () => {
  it("flutter 경계에 순수 코어가 있고 Flutter 를 금지한다", () => {
    const decls = loadLayers("flutter");
    // layer 는 이름이 아니라 **파일 경로 접두사**다. 개념을 하나로 둔다.
    const core = decls.find((d: any) => d.layer === "lib/core");
    expect(core).toBeTruthy();
    expect(core.forbid).toContain("package:flutter/");
  });

  it("roblox 와 unity 도 선언되어 있다", () => {
    expect(loadLayers("roblox").length).toBeGreaterThan(0);
    expect(loadLayers("unity").length).toBeGreaterThan(0);
  });

  it("모든 선언에 이유가 붙어 있다 — 이유 없는 경계가 가장 먼저 지워진다", () => {
    for (const engine of ["flutter", "roblox", "unity"]) {
      for (const d of loadLayers(engine)) {
        expect(String(d.why ?? "").length, `${engine}:${d.layer}`).toBeGreaterThan(20);
      }
    }
  });

  it("알 수 없는 엔진은 기본값으로 떨어지지 않고 던진다", () => {
    expect(() => loadLayers("nope")).toThrow(/nope/);
  });
});

describe("checkPurity", () => {
  const decl = { layer: "lib/core", forbid: ["package:flutter/", "dart:ui"], why: "규칙을 위젯 없이 테스트할 수 있어야 한다. 경계가 무너지면 규칙 변경이 느리고 불안정한 통합 테스트를 통과해야만 한다." };

  it("순수 계층이 엔진을 import 하면 잡는다", () => {
    const r = checkPurity({
      declarations: [decl],
      sources: [{ file: "lib/core/scoring.dart", text: "import 'package:flutter/material.dart';\n" }],
    });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]).toMatchObject({ code: "layer-import", layer: "lib/core", file: "lib/core/scoring.dart", line: 1, forbidden: "package:flutter/" });
  });

  it("위반에 이유가 실려 있다", () => {
    const r = checkPurity({ declarations: [decl], sources: [{ file: "lib/core/a.dart", text: "import 'dart:ui';\n" }] });
    expect(r.violations[0].why).toBe(decl.why);
  });

  it("이유 없는 경계 선언은 던진다", () => {
    expect(() => checkPurity({ declarations: [{ layer: "lib/core", forbid: ["x"] }], sources: [] })).toThrow(/why/i);
  });

  it("선언되지 않은 계층은 검사하지 않는다", () => {
    const r = checkPurity({
      declarations: [decl],
      sources: [{ file: "lib/features/play_page.dart", text: "import 'package:flutter/material.dart';\n" }],
    });
    expect(r.violations).toEqual([]);
  });

  it("엔진을 모른다 — Luau 전역 접근도 같은 검사기가 잡는다", () => {
    const luau = { layer: "src/rules", forbid: ["game:GetService", "script.Parent"], why: "규칙은 DataModel 없이 돌아야 lune 으로 테스트된다. 엔진에 묻으면 스튜디오를 켜야만 검증된다." };
    const r = checkPurity({
      declarations: [luau],
      sources: [{ file: "src/rules/combat.luau", text: "local rs = game:GetService('ReplicatedStorage')\n" }],
    });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].forbidden).toBe("game:GetService");
  });

  // ToonTone 실측: 순수 계층 파일의 **문서 주석**이 "dart:ui 에 의존하지 않는다"라고
  // 적어놓은 것을 위반으로 잡았다. 경계를 지키고 있다고 적은 문장이 경계 위반이 된다.
  // 아래 줄은 lib/core/color/srgb_lab.dart 에서 그대로 뜬 것이다.
  it("주석 줄은 위반이 아니다 — 경계를 설명한 문장을 위반으로 잡으면 안 된다", () => {
    const r = checkPurity({
      declarations: [decl],
      sources: [{ file: "lib/core/color/srgb_lab.dart", text: "/// 색공간 변환. 순수 계산만 하며 Flutter·dart:ui·I/O 에 의존하지 않는다.\n" }],
    });
    expect(r.violations).toEqual([]);
  });

  it("Luau·C# 주석도 건너뛴다", () => {
    const luau = { layer: "src/rules", forbid: ["game:GetService"], why: "규칙은 DataModel 없이 lune 으로 돌아야 한다. 스튜디오를 켜야 하는 검사는 CI 에서 안 돈다." };
    expect(checkPurity({ declarations: [luau], sources: [{ file: "src/rules/a.luau", text: "-- game:GetService 를 쓰지 않는다\n" }] }).violations).toEqual([]);
    expect(checkPurity({ declarations: [luau], sources: [{ file: "src/rules/a.luau", text: "// game:GetService 금지\n" }] }).violations).toEqual([]);
  });

  it("깨끗하면 위반이 없다", () => {
    const r = checkPurity({ declarations: [decl], sources: [{ file: "lib/core/a.dart", text: "import 'dart:math';\n" }] });
    expect(r.violations).toEqual([]);
  });

  it("여러 줄에서 각각 잡고 줄 번호가 맞다", () => {
    const r = checkPurity({
      declarations: [decl],
      sources: [{ file: "lib/core/a.dart", text: "import 'dart:math';\nimport 'dart:ui';\nimport 'package:flutter/foundation.dart';\n" }],
    });
    expect(r.violations.map((v: any) => v.line)).toEqual([2, 3]);
  });
});
