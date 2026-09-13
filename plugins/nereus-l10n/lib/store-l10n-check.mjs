// 스토어 등재 현지화 게이트.
//
// **이 파일은 게이트다.** 로케일 우선순위 조언은 aso-advisor.mjs 가 한다.
// 한 파일에 섞으면 "잘린 채 발행됨"과 "브라질을 먼저 채우면 좋겠음"이 같은 무게로 나와
// 진짜가 묻힌다.
//
// ★ 핵심: **미달은 위반이 아니다.**
//   요구 집합 대비 진행 상태는 `coverage`, 위반은 **선언과 실제가 어긋난 것**뿐이다.
//   미달을 위반으로 내면 운영 중인 제품 전부가 즉시 빨개지고, 그러면 사람이 게이트를 끈다.
//   (ToonTone 에서 하드코딩 검사가 461건을 내고 그중 진짜가 0건이었다 —
//    끄게 만드는 게이트는 게이트가 아니다.)
//
// 도너: wallpaper-deploy 가 19 로케일을 실제로 운영한다(읽기 전용).
// 거기서 나온 것: 앱 제목은 검색 키워드라 일부러 번역하지 않는다 ·
// 진짜 제약은 번역이 아니라 폰트다 · 렌더러는 빠진 글리프를 두부로 그리고 exit 0 한다.
import { pathToFileURL } from "node:url";
import { loadLocales } from "./locales.mjs";
import { readCliInput, runCli } from "./cli-input.mjs";

/** 그 스토어의 로케일 코드 집합. 코드에 목록을 박지 않는다 — 데이터가 정한다. */
function storeLocaleIds(data, store) {
  return Object.entries(data.locales)
    .filter(([, v]) => (v.stores ?? []).includes(store))
    .map(([id]) => id);
}

/**
 * @param store            `locales.json` 의 `stores` 키
 * @param declaredLocales  대상 로케일. **주지 않으면 스토어 전체를 요구한다** — 미설정은 보호다
 * @param listings         `{ [locale]: { title, shortDescription, ... } }`
 * @param excluded         `[{ locale, why }]` — 제외는 삭제가 아니라 분류다
 * @returns `{ violations, coverage, skipped, unmeasured }`
 */
export function checkStoreL10n({
  store = "play",
  declaredLocales = null,
  listings = {},
  excluded = [],
  doNotTranslate = [],
  render = null,
  locales = null,
} = {}) {
  const data = locales ?? loadLocales();
  const meta = data.stores?.[store];
  // 알 수 없는 스토어에 빈 결과를 내면 "검사했는데 문제 없음"으로 읽힌다.
  if (!meta) {
    throw new Error(`알 수 없는 스토어: ${store} (있는 것: ${Object.keys(data.stores ?? {}).join(", ")})`);
  }

  const violations = [];
  const skipped = [];
  const unmeasured = [];
  const known = new Set(storeLocaleIds(data, store));

  // ── 제외 분류 ───────────────────────────────────────────────────────────
  // 이유 없는 제외는 제외가 아니다. 이유 없는 경계가 가장 먼저 지워진다.
  const excludedOk = [];
  for (const e of Array.isArray(excluded) ? excluded : []) {
    if (!e?.why) {
      violations.push({
        code: "declaration-without-why",
        kind: "excluded",
        locale: e?.locale ?? null,
        why: "제외에 이유가 없다. 이유 없는 경계는 다음 사람이 지운다 — 왜 뺐는지 모르면 되돌릴 수도 없다.",
      });
      continue;
    }
    excludedOk.push(e);
  }
  if (excludedOk.length > 0) {
    skipped.push({
      reason: "excluded",
      count: excludedOk.length,
      locales: excludedOk.map((e) => e.locale),
      why: "명시적 이유와 함께 제외됐다. 요구 집합에서 빠지지만 셈은 남는다.",
    });
  }
  const excludedSet = new Set(excludedOk.map((e) => e.locale));

  // ── 요구 집합 ───────────────────────────────────────────────────────────
  // **미설정은 보호다.** 대상을 선언하지 않은 것을 "영어만 하면 된다"로 읽으면
  // 조용히 최악으로 떨어진다. 선언이 없으면 스토어 전체가 요구 집합이다.
  const required = [...known].filter((id) => !excludedSet.has(id));
  const declared = Array.isArray(declaredLocales) ? declaredLocales : required;

  for (const id of declared) {
    if (known.has(id)) continue;
    violations.push({
      code: "locale-code-unknown",
      locale: id,
      store,
      codeStyle: meta.localeCodeStyle ?? null,
      why: `${store} 가 모르는 로케일 코드다. 등재가 거부되는 게 아니라 그 로케일이 그냥 안 생긴다 — 아무 에러도 나지 않는다.`,
    });
  }

  // ── 선언했는데 비었다 ───────────────────────────────────────────────────
  const filled = [];
  for (const id of declared) {
    const entry = listings?.[id];
    const values = entry && typeof entry === "object" ? Object.entries(entry) : [];
    const empty = values.filter(([, v]) => String(v ?? "").trim() === "").map(([f]) => f);
    if (!entry || values.length === 0) {
      violations.push({
        code: "declared-but-empty",
        locale: id,
        fields: null,
        why: "로케일을 선언해 놓고 등재가 없다. Play 는 조용히 기본 로케일로 fallback 하므로 발행은 성공한다.",
      });
      continue;
    }
    if (empty.length > 0) {
      violations.push({
        code: "declared-but-empty",
        locale: id,
        fields: empty,
        why: "선언한 로케일의 필드가 비어 있다. Play 는 조용히 기본 로케일로 fallback 한다 — 그 로케일 사용자는 영어를 본다.",
      });
    }
    if (known.has(id)) filled.push(id);
  }

  // ── 필드 길이 ───────────────────────────────────────────────────────────
  // 제한이 없는 스토어를 통과로 내지 않는다. 모르는 것과 통과한 것을 같게 보고하면
  // 검사되지 않은 것이 통과로 읽힌다.
  const limits = meta.fields ?? null;
  if (!limits) {
    unmeasured.push(`field-limits:${store}`);
  } else {
    for (const [id, entry] of Object.entries(listings ?? {})) {
      for (const [field, limit] of Object.entries(limits)) {
        const len = String(entry?.[field] ?? "").length;
        if (len > limit) {
          violations.push({
            code: "field-length-overflow",
            locale: id,
            field,
            length: len,
            limit,
            why: "스토어 필드 길이 제한을 넘는다. 잘린 채 발행되고 에러가 나지 않는다.",
          });
        }
      }
    }
  }

  // ── 번역 제외 선언 ──────────────────────────────────────────────────────
  // 하네스는 **번역할지 말지를 정하지 않는다.** 앱 이름은 검색 키워드라 번역하면 유입이
  // 끊기고, 설명문은 번역 안 하면 전환이 깎인다. 필드마다 답이 다르고 그건 사업 판단이다.
  // 강제하는 것은 **판단이 기록에 남는 것**뿐 — 선언이 없으면 "판단해서 안 한 것"과
  // "그냥 빠뜨린 것"이 구분되지 않는다.
  const dntOk = new Set();
  for (const d of Array.isArray(doNotTranslate) ? doNotTranslate : []) {
    if (!d?.why) {
      violations.push({
        code: "declaration-without-why",
        kind: "doNotTranslate",
        field: d?.field ?? null,
        why: "번역 제외 선언에 이유가 없다. 이유 없는 경계는 다음 사람이 지운다 — 왜 안 번역했는지 모르면 되돌릴 수도 없다.",
      });
      continue;
    }
    dntOk.add(d.field);
  }

  // 로케일이 하나뿐이면 "전 로케일 동일"이 자명참이라 판정이 의미 없다.
  const present = declared.filter((id) => listings?.[id] && typeof listings[id] === "object");
  if (present.length > 1) {
    const fields = new Set(present.flatMap((id) => Object.keys(listings[id])));
    for (const field of fields) {
      if (dntOk.has(field)) continue;
      const values = present.map((id) => String(listings[id]?.[field] ?? ""));
      if (values.some((v) => v.trim() === "")) continue; // 빈 것은 declared-but-empty 가 이미 본다
      if (new Set(values).size !== 1) continue;
      violations.push({
        code: "untranslated-undeclared",
        field,
        value: values[0],
        locales: present,
        why: "전 로케일이 같은 문자열인데 번역 제외 선언이 없다. 판단해서 그렇게 한 것과 빠뜨린 것이 구분되지 않는다 — 앱 이름처럼 일부러 안 하는 것이면 이유와 함께 선언한다.",
      });
    }
  }

  // ── 두부 증거와 RTL 런 ──────────────────────────────────────────────────
  // 렌더러는 빠진 글리프를 .notdef 로 그리고 **exit 0** 한다. 로케일 하나가 통째로
  // 두부로 나가는데 모든 게이트가 초록이다. 하네스는 폰트를 파싱하지 않는다 —
  // 실제 렌더러가 쓰는 폰트와 다를 수 있어 파싱해도 그 사고를 못 막는다.
  // 검증은 **렌더 직후 그 자리에서** 해야 의미가 있으므로 증거를 요구한다.
  for (const [id, r] of Object.entries(render ?? {})) {
    const glyph = r?.glyphCheck;
    if (!glyph || !glyph.ranAt) {
      violations.push({
        code: "tofu-unverified",
        locale: id,
        why: "렌더 대상인데 글리프 검증 증거가 없다. 렌더러는 빠진 글리프를 두부로 그리고 성공 코드로 끝난다 — 미설정을 통과로 읽으면 그 사고가 그대로 재현된다.",
      });
    } else {
      for (const m of glyph.missing ?? []) {
        violations.push({
          code: "glyph-missing",
          locale: id,
          face: m?.face ?? null,
          chars: m?.chars ?? null,
          why: "검증 증거에 빠진 글리프가 있다. 그대로 렌더하면 그 자리가 두부로 발행된다.",
        });
      }
    }

    // RTL 판정은 데이터의 direction 으로만 한다 — 코드에 목록을 박지 않는다.
    const runs = Number(r?.titleRuns);
    if (data.locales?.[id]?.direction === "rtl" && Number.isFinite(runs) && runs > 1) {
      violations.push({
        code: "rtl-split-run",
        locale: id,
        titleRuns: runs,
        why: "RTL 로케일의 타이틀을 여러 조각으로 그린다. 셰이퍼에 조각을 따로 넘기면 공백이 사라지고 조각 순서가 뒤집힌다 — 두 톤 타이틀은 올바른 텍스트의 대가다.",
      });
    }
  }

  const presentSet = new Set(filled);
  return {
    violations,
    coverage: {
      store,
      required: required.length,
      present: presentSet.size,
      missing: required.filter((id) => !presentSet.has(id)),
      whyNotViolation:
        "요구 집합 미달은 진행 상태이지 결함이 아니다. 전부 빨개지는 게이트는 꺼지고, 꺼진 게이트는 아무것도 막지 못한다.",
    },
    skipped,
    unmeasured,
  };
}

// 실행 진입점. **검사기를 만들고 프로세스로 부르는 곳이 없으면 그것은 게이트가 아니다.**
// 코어 doctor 가 정확히 그 상태였다(단위 테스트 전부 초록 · `node doctor.mjs` 는 0바이트, 2026-09-13).
// pathToFileURL 을 쓴다 — `file://${argv[1]}` 은 Windows 경로에서 깨진다.
// 성공 경로에서 process.exit(0) 을 부르지 않는다 — 파이프 stdout 이 64KiB 에서 잘린다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(checkStoreL10n(readCliInput())) + "\n");
  });
}
