// Unity(2D 폰게임 포함) 프로젝트의 스택·테스트러너 판정.
//
// 코어의 확장 선언(marker/runnerMarker)은 **파일 존재만** 본다. 여기서는 매니페스트 내용까지 읽어
// 테스트 프레임워크가 실제로 들어 있는지 확인한다 — 프레임워크 없이 러너를 돌려주면
// TDD 게이트가 매번 실패하고, 그러면 게이트를 꺼버리게 된다.
import fs from "node:fs";
import path from "node:path";

const defaultFs = {
  exists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, "utf8"),
};

export const UNITY_MARKER = "ProjectSettings/ProjectVersion.txt";
export const UNITY_MANIFEST = "Packages/manifest.json";
const TEST_PACKAGE = "com.unity.test-framework";

// 내부 전용. 밖에서 쓰는 곳이 생기기 전에는 export 하지 않는다 —
// 이번 사이클에 "선언했는데 아무도 안 쓰는 것"으로 세 번 물렸다.
function isUnityProject(cwd, fsx = defaultFs) {
  return fsx.exists(path.join(cwd, UNITY_MARKER));
}

/** @returns {{ runner: string, command: string } | null} */
export function detectUnityRunner(cwd, fsx = defaultFs) {
  if (!isUnityProject(cwd, fsx)) return null;
  const manifestPath = path.join(cwd, UNITY_MANIFEST);
  if (!fsx.exists(manifestPath)) return null;
  let deps;
  try {
    deps = JSON.parse(fsx.readFile(manifestPath))?.dependencies;
  } catch {
    // 매니페스트를 못 읽으면 러너가 있다고 단정하지 않는다.
    // 한계: 깨진 매니페스트와 "테스트 프레임워크 없음"이 구분되지 않아 TDD 게이트가 조용히 꺼진다.
    // 훅에는 경고 채널이 없어 여기서 알릴 방법이 없다 — unity 스킬이 이 경우를 점검 항목으로 다룬다.
    return null;
  }
  if (!deps || !deps[TEST_PACKAGE]) return null;
  return { runner: "unity-test-framework", command: "Unity -runTests -batchmode -nographics -quit" };
}
