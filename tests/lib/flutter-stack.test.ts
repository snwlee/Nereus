// 검증 대상(ToonTone)이 Flutter 폰게임인데 스택 스킬이 없어 하네스가 정식으로 못 붙었다.
// 앞 두 사이클에서 플레이버 목록과 계층 경계를 손으로 만들어 넣었다 — 그걸 산출물에서 읽는다.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectFlutterGame } from "../../plugins/nereus-game/lib/flutter-stack.mjs";

let root = "";
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-flutter-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const write = (rel: string, text: string) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
const srcSets = (...names: string[]) => {
  for (const n of names) fs.mkdirSync(path.join(root, "android/app/src", n), { recursive: true });
};
const PUBSPEC = "name: toy\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n";

describe("detectFlutterGame — 프로젝트 판정", () => {
  it("pubspec.yaml 이 없으면 null 이다", () => {
    expect(detectFlutterGame(root)).toBeNull();
  });

  it("테스트 러너를 낸다", () => {
    write("pubspec.yaml", PUBSPEC);
    const r = detectFlutterGame(root)!;
    expect(r.runner).toBe("flutter_test");
    expect(r.command).toBe("flutter test");
  });

  it("flutter_test 가 없으면 러너가 null 이다 — 게이트를 조용히 켜지 않는다", () => {
    write("pubspec.yaml", "name: toy\ndependencies:\n  flutter:\n    sdk: flutter\n");
    expect(detectFlutterGame(root)!.runner).toBeNull();
  });

  it("계층 경계를 같이 내서 purity-check 에 그대로 넘길 수 있다", () => {
    write("pubspec.yaml", PUBSPEC);
    const r = detectFlutterGame(root)!;
    expect(r.layers.length).toBeGreaterThan(0);
    expect(r.layers.some((d: any) => d.layer === "lib/core")).toBe(true);
    expect(r.layers.every((d: any) => String(d.why).length > 20)).toBe(true);
  });
});

describe("detectFlutterGame — Flame", () => {
  it("의존이 있으면 present 이고 제약이 실린다", () => {
    write("pubspec.yaml", "name: toy\ndependencies:\n  flutter:\n    sdk: flutter\n  flame: ^1.38.2\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n");
    const r = detectFlutterGame(root)!;
    expect(r.flame.present).toBe(true);
    expect(r.flame.constraint).toBe("^1.38.2");
  });

  it("없는 것은 결함이 아니라 상태다", () => {
    write("pubspec.yaml", PUBSPEC);
    const r = detectFlutterGame(root)!;
    expect(r.flame.present).toBe(false);
    expect(r.flame.constraint).toBeNull();
  });

  it("dev_dependencies 의 flame_test 만 있어도 flame 은 아니다", () => {
    write("pubspec.yaml", "name: toy\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flame_test: ^2.3.1\n");
    expect(detectFlutterGame(root)!.flame.present).toBe(false);
  });
});

describe("detectFlutterGame — 플레이버", () => {
  it("소스 세트에서 읽고 빌드 타입을 뺀다", () => {
    write("pubspec.yaml", PUBSPEC);
    srcSets("main", "debug", "profile", "flag", "art");
    expect(detectFlutterGame(root)!.flavors).toEqual(["art", "flag"]);
  });

  it("못 찾으면 빈 배열이 아니라 null 이다 — 없는 것과 못 찾은 것은 다르다", () => {
    write("pubspec.yaml", PUBSPEC);
    const r = detectFlutterGame(root)!;
    expect(r.flavors).toBeNull();
    expect(r.notes.join(" ")).toMatch(/android\/app\/src/);
  });

  it("빌드 타입만 있으면 플레이버가 0개지 못 찾은 게 아니다", () => {
    write("pubspec.yaml", PUBSPEC);
    srcSets("main", "debug", "profile");
    expect(detectFlutterGame(root)!.flavors).toEqual([]);
  });

  it("제외 목록은 데이터다", () => {
    write("pubspec.yaml", PUBSPEC);
    srcSets("main", "debug", "profile", "flag");
    expect(detectFlutterGame(root, { buildTypes: ["main"] })!.flavors).toEqual(["debug", "flag", "profile"]);
  });

  it("파일은 플레이버가 아니다 — 디렉터리만 본다", () => {
    write("pubspec.yaml", PUBSPEC);
    srcSets("main", "flag");
    write("android/app/src/README.md", "x");
    expect(detectFlutterGame(root)!.flavors).toEqual(["flag"]);
  });
});
