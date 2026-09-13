// 폰트 검사기.
//
// 폰트는 미감 문제가 아니라 **라이선스·용량·가독성 문제**다.
//  - 상당수 폰트가 특정 임베딩을 금지하거나 별도 계약을 요구한다. 웹폰트 라이선스로
//    게임에 넣으면 위반이다. 그래서 **선언이 없으면 허용으로 치지 않는다** — 모름은 허용이 아니다.
//  - 요구 임베딩 종류는 **제품이 정한다**(게임은 "game"). 코드에 박지 않고 입력으로 받는다.
//    안 주면 검사를 건너뛰는 것이 아니라 미선언으로 낸다 — 건너뛰면 검사 안 한 것이 통과로 읽힌다.
//  - 한글은 11,172자다. 폰트가 그 스크립트를 안 덮으면 화면에 두부(tofu)가 나온다.
//  - 서브셋은 용량 문제의 표준 해법이지만, 닉네임·채팅처럼 **어떤 글자가 올지 모르는**
//    텍스트가 있으면 유저 이름이 깨진다. 용량 최적화의 대가가 그거면 최적화가 아니다.
//
// 글리프 판정은 **선언 대조**다(폰트 파일을 파싱하지 않는다). 실제 파일 검사보다 약하지만,
// 지금 0 인 것을 선언 수준으로 올리는 것이 먼저다 — 선언이 있어야 나중에 파싱을 얹을 자리가 생긴다.
import { pathToFileURL } from "node:url";
import { readCliInput, runCli } from "./cli-input.mjs";
import { loadLocales } from "./locales.mjs";

/**
 * @param requiredEmbedding 요구 임베딩 종류. **안 주면 검사를 건너뛰지 않고 미선언으로 낸다.**
 * @param typography 예산 기준 `{ maxFontKb, minSizePx }`. `profile.typography` 대신 직접 줄 수 있다 —
 *                   장르 프로파일은 게임 고유라 이 모듈이 전제하지 않는다.
 */
export function checkFonts({ profile, typography = null, requiredEmbedding = null, fonts = [], locales, targetLocales = [], userGeneratedText = false } = {}) {
  const violations = [];
  const unmeasured = [];
  const list = Array.isArray(fonts) ? fonts : [];

  if (!requiredEmbedding) {
    violations.push({
      code: "required-embedding-undeclared",
      why: "요구 임베딩 종류가 선언되지 않았다. 건너뛰면 라이선스를 검사하지 않은 것이 통과로 읽힌다 — 모름은 허용이 아니다.",
    });
  }

  for (const f of list) {
    const embedding = Array.isArray(f?.embedding) ? f.embedding : null;
    if (requiredEmbedding && (!embedding || !embedding.includes(requiredEmbedding))) {
      violations.push({ code: "license-embedding", font: f?.name ?? "", embedding: embedding ?? null, required: requiredEmbedding });
    }
    if (userGeneratedText && f?.subset) {
      violations.push({ code: "subset-unsafe", font: f?.name ?? "" });
    }
  }

  const covered = new Set(list.flatMap((f) => (Array.isArray(f?.scripts) ? f.scripts : [])));
  for (const id of targetLocales) {
    const script = locales?.locales?.[id]?.script;
    if (!script) continue;
    if (!covered.has(script)) violations.push({ code: "script-uncovered", locale: id, script });
  }

  const base = typography ?? profile?.typography;
  if (!base || typeof base !== "object") {
    // 라이선스·스크립트·서브셋은 프로파일과 무관하므로 계속 판정한다.
    // 예산과 크기만 기준이 없어 못 본다 — 그것만 unmeasured 다.
    unmeasured.push("typography-baseline");
    return { violations, unmeasured };
  }

  const totalKb = list.reduce((a, f) => a + (Number(f?.sizeKb) || 0), 0);
  const maxKb = Number(base.maxFontKb);
  if (Number.isFinite(maxKb) && totalKb > maxKb) {
    violations.push({ code: "font-size-budget", totalKb, max: maxKb });
  }

  const minSize = Number(base.minSizePx);
  if (Number.isFinite(minSize)) {
    for (const f of list) {
      const px = Number(f?.minSizePx);
      if (Number.isFinite(px) && px < minSize) {
        violations.push({ code: "min-size", font: f?.name ?? "", minSizePx: px, min: minSize });
      }
    }
  }

  return { violations, unmeasured };
}

// 실행 진입점. stdin 으로 { fonts, targetLocales, userGeneratedText, requiredEmbedding, typography } 를 받는다.
// **장르를 받지 않는다** — 장르 프로파일은 게임 고유다. 게임은 profile.typography 를 꺼내
// typography 로 넘긴다. 이 모듈이 형제 플러그인을 전제하면 설치 조합에 따라 조용히 깨진다.
//
// pathToFileURL 을 쓴다 — `file://${argv[1]}` 은 Windows 경로에서 깨진다.
// 성공 경로에서 process.exit(0) 을 부르지 않는다 — 파이프 stdout 이 64KiB 에서 잘린다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    const input = readCliInput();
    const result = checkFonts({
      typography: input.typography ?? null,
      requiredEmbedding: input.requiredEmbedding ?? null,
      fonts: input.fonts,
      locales: loadLocales(),
      targetLocales: input.targetLocales ?? [],
      userGeneratedText: Boolean(input.userGeneratedText),
    });
    process.stdout.write(JSON.stringify(result) + "\n");
  });
}
