// 렌더 예산의 **런타임 증거** 판정. 입력은 `renderer.info` 표본이다.
//
// 두 가지를 지킨다.
// 1. **기준이 없으면 판정하지 않는다.** 드로우콜 상한은 기기 등급·해상도·씬 복잡도가 정하는
//    운영값이라 데이터 파일에 기본값을 두면 정책인 척하면서 낡는다. 없으면 `unmeasured` 에 싣는다.
// 2. **누수는 단발 스냅샷으로 판정하지 않는다.** 지오메트리 99,999개는 누수가 아니라 큰 씬일 수 있다.
//    같은 라벨(= 같은 상태로 돌아왔다)의 두 표본을 비교해 늘었을 때만 누수로 본다.
import { loadBudgetData } from "./budget-data.mjs";
import { pathToFileURL } from "node:url";
import { readCliInput, runCli } from "./cli-input.mjs";

/** `renderer.info` 에서 판정 축과 값을 뽑는다. 없는 축은 싣지 않는다. */
function axesOf(info = {}) {
  const render = info.render ?? {};
  const memory = info.memory ?? {};
  const pairs = [
    ["calls", render.calls],
    ["triangles", render.triangles],
    ["points", render.points],
    ["lines", render.lines],
    ["geometries", memory.geometries],
    ["textures", memory.textures],
    ["programs", info.programs],
  ];
  return Object.fromEntries(pairs.filter(([, v]) => typeof v === "number"));
}

/**
 * 표본을 예산·누수 기준으로 판정한다.
 * @param {{ samples?: {label: string, info: object}[], budgets?: Record<string, number>, data?: object }} input
 * @returns `{ violations, unmeasured }`
 */
export function checkRenderBudget({ samples = [], budgets = null, data = loadBudgetData() } = {}) {
  const violations = [];
  const unmeasured = [];
  const leakAxes = data.leakAxes;

  if (samples.length === 0) {
    unmeasured.push({
      what: "표본이 없다 — 아무것도 측정하지 않았다",
      why:
        "renderer.info 를 수집한 표본이 없으면 드로우콜도 GPU 메모리도 알 수 없다. " +
        "증거가 없는 것을 통과로 읽지 않는다.",
    });
    return { violations, unmeasured, samples: 0 };
  }

  if (!budgets || Object.keys(budgets).length === 0) {
    unmeasured.push({
      what: "예산 기준이 주어지지 않아 상한 판정을 하지 않았다",
      why:
        "드로우콜·텍스처 상한은 기기 등급·해상도·씬 복잡도가 정하는 운영값이다. " +
        "지어낸 기준은 그럴듯하게 틀린다 — 호출부가 자기 목표 기기의 값을 넘겨야 한다.",
    });
  } else {
    for (const sample of samples) {
      const axes = axesOf(sample.info);
      for (const [axis, limit] of Object.entries(budgets)) {
        const value = axes[axis];
        if (typeof value !== "number" || typeof limit !== "number") continue;
        if (value <= limit) continue;
        violations.push({
          code: "budget-exceeded",
          label: sample.label,
          axis,
          value,
          limit,
          why: `표본 '${sample.label}' 의 ${axis} 가 ${value} 로 상한 ${limit} 을 넘는다.`,
        });
      }
    }
  }

  // 같은 라벨 = 같은 상태로 돌아왔다. 거기서 늘었으면 정리되지 않은 것이다.
  const byLabel = new Map();
  for (const sample of samples) {
    const list = byLabel.get(sample.label) ?? [];
    byLabel.set(sample.label, [...list, sample]);
  }
  const singles = [];
  for (const [label, list] of byLabel) {
    if (list.length < 2) {
      singles.push(label);
      continue;
    }
    const first = axesOf(list[0].info);
    const last = axesOf(list[list.length - 1].info);
    for (const axis of leakAxes) {
      if (typeof first[axis] !== "number" || typeof last[axis] !== "number") continue;
      if (last[axis] <= first[axis]) continue;
      violations.push({
        code: "leak-suspected",
        label,
        axis,
        from: first[axis],
        to: last[axis],
        why:
          `라벨 '${label}' 로 같은 상태에 다시 왔는데 ${axis} 가 ${first[axis]} → ${last[axis]} 로 늘었다. ` +
          "정리되지 않은 자원이 GPU 에 남아 있다.",
        fix: "그 상태를 떠나는 경로에서 dispose 가 실제로 불리는지 본다 — scene-scan 의 dispose-unwired 를 같이 본다.",
      });
    }
  }

  if (singles.length > 0) {
    unmeasured.push({
      what: `표본이 하나뿐인 라벨 ${singles.length}개는 누수를 판정하지 않았다`,
      why:
        `누수는 같은 상태의 두 표본 비교다. 수가 큰 것은 큰 씬일 수 있다 — ` +
        `단발로 판정하면 큰 씬이 전부 빨개진다. 라벨: ${singles.join(", ")}`,
    });
  }

  return { violations, unmeasured, samples: samples.length };
}

// 프로세스 진입점. stdin JSON → stdout JSON. 성공 경로에서 process.exit(0) 금지.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    process.stdout.write(`${JSON.stringify(checkRenderBudget(readCliInput()), null, 2)}\n`);
  });
}
