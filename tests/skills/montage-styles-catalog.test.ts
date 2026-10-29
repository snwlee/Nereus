import { describe, it, expect } from "vitest";
import { normalizeStyle, tokens, pickStyles, BLOCKED_STYLES } from "../../plugins/nereus/skills/montage/scripts/style-catalog.mjs";

const artDeco = { slug: "art-deco", num: "18", en: "Art Deco", cn: "装饰艺术", category_en: "Graphic & Type", category_cn: "图形与排版",
  film: "Midnight at the Starlight Hotel", line: "A grand hotel, 1930: a bellboy races lifts and revolving doors to deliver one letter before midnight.",
  uses: ["Luxury & hospitality", "Galas", "Invitations"], frame_sec: 17.52, dur: 58.4 };
const ascii = { slug: "ascii-crt", en: "ASCII / CRT Terminal", category_en: "Graphic & Type", film: "Tranquility.log",
  line: "A moon-base AI wakes after forty years to a signal from Earth.", uses: ["Developer tools", "Sci-fi", "Tech brands"], dur: 59.8 };
const screencast = { slug: "living-screencast", en: "Living Screencast", category_en: "Screen & UI", film: "Clawd ships",
  line: "A desktop comes alive as the agent works.", uses: ["Developer tools", "Product demos"], dur: 50 };
const cat = [ascii, artDeco, screencast].map((s) => normalizeStyle(s)!);

describe("montage-styles.catalog", () => {
  it("정규화", () => {
    expect(normalizeStyle(artDeco)).toEqual({ slug: "art-deco", name: "Art Deco", category: "Graphic & Type",
      uses: ["Luxury & hospitality", "Galas", "Invitations"], film: "Midnight at the Starlight Hotel", line: artDeco.line, dur: 58.4 });
  });
  it("템플릿·잘못된 slug 제외, uses 없으면 빈 배열", () => {
    expect(normalizeStyle({ slug: "_template", en: "x" })).toBeNull();
    expect(normalizeStyle({ slug: "../x", en: "x" })).toBeNull();
    expect(normalizeStyle({ slug: "plain", en: "Plain" })!.uses).toEqual([]);
  });
  it("토큰 — 소문자·구두점 분리·복수 s 제거·한글 유지", () => {
    expect(tokens("Luxury & Galas, Invitations! 고급 호텔 a")).toEqual(["luxury", "gala", "invitation", "고급", "호텔"]);
  });
});

describe("montage-styles.pick", () => {
  it("용도 매칭", () => {
    const r = pickStyles(cat, "luxury hotel gala invitation");
    expect(r[0].slug).toBe("art-deco");
    expect(r[0].matched).toEqual(["gala", "hotel", "invitation", "luxury"]);
    expect(r[0].score).toBe(4);
  });
  it("점수 0 은 빼고 n 개까지", () => {
    expect(pickStyles(cat, "zzzz qqqq")).toEqual([]);
    expect(pickStyles(cat, "developer tools", { n: 1 })).toHaveLength(1);
  });
  it("동점은 slug 사전순, 결정적", () => {
    const a = pickStyles(cat, "developer tools").map((x) => x.slug);
    expect(a).toEqual(["ascii-crt", "living-screencast"]);
    expect(pickStyles(cat, "developer tools").map((x) => x.slug)).toEqual(a);
  });
  it("광고면 차단 스타일 제외, 비상업이면 경고", () => {
    expect(BLOCKED_STYLES["living-screencast"]).toMatch(/Clawd/);
    expect(pickStyles(cat, "developer tools", { commercial: true }).map((x) => x.slug)).toEqual(["ascii-crt"]);
    const nc = pickStyles(cat, "developer tools", { commercial: false });
    expect(nc.find((x) => x.slug === "living-screencast")!.warning).toMatch(/Clawd/);
  });
});
