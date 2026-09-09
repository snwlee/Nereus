import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  WANTED,
  parseNetscape,
  parseCookieJson,
  parseExport,
  pickGeminiCookies,
  outputPath,
  formatSummary,
} from "../../plugins/nereus/skills/image/scripts/cookies-import.mjs";

const PSID = "g.a000xyzABC-123_def";
const PSIDTS = "sidts-CjIB000abcDEF";

describe("parseNetscape", () => {
  it("reads the standard tab-separated export", () => {
    const txt = [
      "# Netscape HTTP Cookie File",
      "# This is a generated file!  Do not edit.",
      "",
      `.google.com\tTRUE\t/\tTRUE\t1790000000\t__Secure-1PSID\t${PSID}`,
      `.google.com\tTRUE\t/\tTRUE\t1790000000\t__Secure-1PSIDTS\t${PSIDTS}`,
    ].join("\n");
    const out = parseNetscape(txt);
    expect(out).toEqual([
      { domain: ".google.com", name: "__Secure-1PSID", value: PSID },
      { domain: ".google.com", name: "__Secure-1PSIDTS", value: PSIDTS },
    ]);
  });

  it("accepts the #HttpOnly_ prefix that curl and yt-dlp emit", () => {
    const txt = `#HttpOnly_.google.com\tTRUE\t/\tTRUE\t0\t__Secure-1PSID\t${PSID}`;
    expect(parseNetscape(txt)).toEqual([{ domain: ".google.com", name: "__Secure-1PSID", value: PSID }]);
  });

  it("skips comments, blank lines and short rows without throwing", () => {
    expect(parseNetscape("# only a comment\n\n\ttoo\tshort\n")).toEqual([]);
    expect(parseNetscape("")).toEqual([]);
  });

  it("keeps tabs out of the value but tolerates trailing whitespace", () => {
    const txt = `.google.com\tTRUE\t/\tTRUE\t0\t__Secure-1PSID\t${PSID}   \n`;
    expect(parseNetscape(txt)[0].value).toBe(PSID);
  });
});

describe("parseCookieJson", () => {
  it("reads the Cookie-Editor array of objects", () => {
    const json = JSON.stringify([
      { domain: ".google.com", name: "__Secure-1PSID", value: PSID, httpOnly: true, secure: true },
      { domain: ".google.com", name: "__Secure-1PSIDTS", value: PSIDTS, httpOnly: true, secure: true },
      { domain: ".google.com", name: "NID", value: "irrelevant" },
    ]);
    const out = parseCookieJson(json);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ name: "__Secure-1PSID", value: PSID });
  });

  it("also reads a plain {name: value} object, which is what our own cookie file looks like", () => {
    const out = parseCookieJson(JSON.stringify({ "__Secure-1PSID": PSID, "__Secure-1PSIDTS": PSIDTS }));
    expect(out).toEqual([
      { domain: "", name: "__Secure-1PSID", value: PSID },
      { domain: "", name: "__Secure-1PSIDTS", value: PSIDTS },
    ]);
  });

  it("returns null on anything that is not JSON so the caller can try Netscape", () => {
    expect(parseCookieJson("# Netscape HTTP Cookie File")).toBeNull();
    expect(parseCookieJson("")).toBeNull();
  });
});

describe("parseExport", () => {
  it("picks the format by content, not by file extension", () => {
    const json = JSON.stringify([{ name: "__Secure-1PSID", value: PSID }]);
    expect(parseExport(json)[0].name).toBe("__Secure-1PSID");
    expect(parseExport(`.google.com\tTRUE\t/\tTRUE\t0\t__Secure-1PSID\t${PSID}`)[0].value).toBe(PSID);
  });
});

describe("pickGeminiCookies", () => {
  it("keeps only the two cookies gemini_webapi needs", () => {
    const got = pickGeminiCookies([
      { name: "NID", value: "x" },
      { name: "__Secure-1PSID", value: PSID },
      { name: "__Secure-1PSIDTS", value: PSIDTS },
    ]);
    expect(Object.keys(got.cookies).sort()).toEqual([...WANTED].sort());
    expect(got.cookies["__Secure-1PSID"]).toBe(PSID);
    expect(got.missing).toEqual([]);
  });

  it("validates the value shape — a truncated paste is the common failure", () => {
    // __Secure-1PSID always starts with "g.", __Secure-1PSIDTS with "sidts-".
    const got = pickGeminiCookies([
      { name: "__Secure-1PSID", value: "not-a-psid" },
      { name: "__Secure-1PSIDTS", value: PSIDTS },
    ]);
    expect(got.cookies["__Secure-1PSID"]).toBeUndefined();
    expect(got.invalid).toContainEqual({ name: "__Secure-1PSID", why: expect.stringContaining("g.") });
  });

  it("reports what is missing instead of writing a half file", () => {
    const got = pickGeminiCookies([{ name: "__Secure-1PSID", value: PSID }]);
    expect(got.missing).toEqual(["__Secure-1PSIDTS"]);
    expect(got.ok).toBe(false);
  });

  it("is ok only when both are present and well-formed", () => {
    expect(pickGeminiCookies([
      { name: "__Secure-1PSID", value: PSID },
      { name: "__Secure-1PSIDTS", value: PSIDTS },
    ]).ok).toBe(true);
  });

  it("takes the last occurrence when a cookie appears twice", () => {
    const got = pickGeminiCookies([
      { name: "__Secure-1PSID", value: "g.old" },
      { name: "__Secure-1PSIDTS", value: PSIDTS },
      { name: "__Secure-1PSID", value: PSID },
    ]);
    expect(got.cookies["__Secure-1PSID"]).toBe(PSID);
  });
});

describe("outputPath", () => {
  it("honours GEMINI_WEB_COOKIES above everything else", () => {
    const p = outputPath({ env: { GEMINI_WEB_COOKIES: "/tmp/c.json" }, platform: "darwin", home: "/home/u" });
    expect(p).toBe("/tmp/c.json");
  });

  it("writes under the nereus config dir so gemini_cli.py finds it", () => {
    expect(outputPath({ env: {}, platform: "darwin", home: "/home/u" }))
      .toBe(path.join("/home/u", ".config", "nereus", "secrets", "gemini-web-cookies.json"));
  });

  it("uses APPDATA on Windows, matching gemini_cli.py", () => {
    expect(outputPath({ env: { APPDATA: "C:\\Users\\u\\AppData\\Roaming" }, platform: "win32", home: "C:\\Users\\u" }))
      .toBe(path.join("C:\\Users\\u\\AppData\\Roaming", "nereus", "secrets", "gemini-web-cookies.json"));
  });

  it("respects NEREUS_HOME for test isolation", () => {
    expect(outputPath({ env: { NEREUS_HOME: "/tmp/nh" }, platform: "darwin", home: "/home/u" }))
      .toBe(path.join("/tmp/nh", "secrets", "gemini-web-cookies.json"));
  });
});

describe("formatSummary", () => {
  it("never prints a cookie value — the file is a secret", () => {
    const s = formatSummary({ ok: true, cookies: { "__Secure-1PSID": PSID, "__Secure-1PSIDTS": PSIDTS }, missing: [], invalid: [] }, "/out/c.json");
    expect(s).not.toContain(PSID);
    expect(s).not.toContain(PSIDTS);
    expect(s).toContain("__Secure-1PSID");
    expect(s).toContain("/out/c.json");
  });

  it("names what to fix when the export was incomplete", () => {
    const s = formatSummary({ ok: false, cookies: {}, missing: ["__Secure-1PSIDTS"], invalid: [{ name: "__Secure-1PSID", why: "g. 로 시작해야" }] }, "/out/c.json");
    expect(s).toContain("__Secure-1PSIDTS");
    expect(s).toMatch(/gemini\.google\.com/);
  });
});
