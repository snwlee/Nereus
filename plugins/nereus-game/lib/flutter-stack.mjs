// Flutter 게임 프로젝트의 사실 수집.
//
// **스택 선언은 코어가 소유한다.** `plugins/nereus/hooks/scripts/lib/stack.mjs` 가
// 이미 `pubspec.yaml` → flutter, `flutter_test` → `flutter test` 를 판정한다.
// `nereus-extension.json` 의 stacks 에 flutter 를 또 넣으면 같은 것을 두 곳이 정하고,
// 어긋날 때 어느 쪽이 진실인지 알 수 없다. 여기는 **게임에 필요한 사실**만 얹는다 —
// unity-stack.mjs 가 코어의 파일 존재 판정 위에 매니페스트 내용 판정을 얹은 것과 같은 층이다.
//
// 한 번 돌리면 다른 검사기의 입력이 나온다. 앞 두 사이클에서 ToonTone 에 검사기를
// 돌릴 때마다 플레이버 목록과 계층 경계를 **손으로 만들어 넣었다** — 손으로 만드는 입력은
// 프로젝트마다 다시 만들어야 하고 틀려도 아무도 모른다. 산출물에서 읽는다.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLayers } from "./purity-check.mjs";
import { readCliInput, runCli } from "./cli-input.mjs";

// 빌드 타입은 플레이버가 아니다. 코드에 박으면 다른 프로젝트에서 틀린다 — 데이터로 받는다.
const DEFAULT_BUILD_TYPES = ["main", "debug", "profile", "androidTest", "test"];
const SRC_SETS = "android/app/src";

// pubspec 은 YAML 이지만 파서를 들이지 않는다. 우리가 보는 것은 최상위 섹션 아래의
// "이름: 제약" 한 줄뿐이고, 그걸 위해 의존성을 하나 늘릴 이유가 없다.
// 한계: 블록 스칼라·앵커·따옴표 친 키는 못 본다. 의존성 선언에는 사실상 안 쓰인다.
function dependencyConstraint(pubspec, name, section = "dependencies") {
  const lines = String(pubspec).split("\n");
  let inSection = false;
  for (const line of lines) {
    if (/^[A-Za-z_][\w-]*:/.test(line)) {
      inSection = line.startsWith(`${section}:`);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s{2}([\w-]+):\s*(.*)$/);
    if (!m || m[1] !== name) continue;
    // `flame: ^1.38.2` 는 제약, `flutter:\n    sdk: flutter` 는 빈 값이다.
    return m[2].trim() || "";
  }
  return null;
}

/**
 * Flutter 게임 프로젝트의 사실을 모은다. Flutter 프로젝트가 아니면 null.
 *
 * `flavors` 가 `null` 인 것과 `[]` 인 것은 다르다 — 전자는 **못 찾았다**,
 * 후자는 **없다**. 빈 배열을 주면 parity-check 가 "플레이버 없는 프로젝트"로 읽어
 * 검사 대상이 아니라고 판정한다. countScope 의 matched: null 과 같은 규율이다.
 */
export function detectFlutterGame(root, { buildTypes = null } = {}) {
  const pubspecPath = path.join(root, "pubspec.yaml");
  if (!fs.existsSync(pubspecPath)) return null;
  const pubspec = fs.readFileSync(pubspecPath, "utf8");
  const notes = [];

  // 코어와 같은 판정이지만 여기서 다시 본다 — 러너 없이 러너를 돌려주면 TDD 게이트가
  // 매번 실패하고, 그러면 게이트를 꺼버리게 된다.
  const hasTestSdk = dependencyConstraint(pubspec, "flutter_test", "dev_dependencies") !== null;
  if (!hasTestSdk) notes.push("dev_dependencies 에 flutter_test 가 없다. TDD 게이트가 켜지지 않는다.");

  const flameConstraint = dependencyConstraint(pubspec, "flame");
  const flameTest = dependencyConstraint(pubspec, "flame_test", "dev_dependencies");
  if (flameConstraint !== null && flameTest === null) {
    notes.push("flame 을 쓰는데 dev_dependencies 에 flame_test 가 없다. 컴포넌트·골든 테스트를 쓸 수 없다.");
  }

  const srcDir = path.join(root, SRC_SETS);
  let flavors = null;
  if (!fs.existsSync(srcDir)) {
    // 없는 것이 아니라 못 찾은 것이다. 안드로이드 디렉터리가 없거나 구조가 다를 수 있다.
    notes.push(`${SRC_SETS} 가 없어 플레이버를 셀 수 없다. 없다는 뜻이 아니다 — 구조가 다르면 직접 넘긴다.`);
  } else {
    const exclude = new Set(buildTypes ?? DEFAULT_BUILD_TYPES);
    flavors = fs
      .readdirSync(srcDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !exclude.has(e.name))
      .map((e) => e.name)
      .sort();
  }

  return {
    runner: hasTestSdk ? "flutter_test" : null,
    command: hasTestSdk ? "flutter test" : null,
    // 없는 것은 결함이 아니라 상태다. ToonTone 은 순수 Flutter 이고 그게 맞는 선택이었다.
    flame: { present: flameConstraint !== null, constraint: flameConstraint || null, testPackage: flameTest !== null },
    flavors,
    // Flame 유무가 계층 경계를 바꾸지 않는다 — 순수 층은 어느 쪽에서도 같다.
    // 경계를 데이터로 둔 덕을 보는 첫 사례다.
    layers: loadLayers("flutter"),
    notes,
  };
}

// 실행 진입점. stdin 으로 { root, buildTypes } 를 받아 JSON 을 낸다.
// 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    const input = readCliInput();
    const root = input.root ?? process.cwd();
    const found = detectFlutterGame(root, { buildTypes: input.buildTypes ?? null });
    if (!found) throw new Error(`Flutter 프로젝트가 아니다: ${root} (pubspec.yaml 이 없다)`);
    process.stdout.write(JSON.stringify(found) + "\n");
  });
}
