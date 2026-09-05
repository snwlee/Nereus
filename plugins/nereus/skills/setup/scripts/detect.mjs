// 외부 도구 설치 상태 감지. 설치 명령은 플랫폼별 문자열이며 실행은 SKILL이 사용자 승인 후 한다.
import { which } from "../../../hooks/scripts/lib/exec.mjs";

const npm = (pkg) => ({ darwin: `npm install -g ${pkg}`, win32: `npm install -g ${pkg}`, linux: `npm install -g ${pkg}` });

export const TOOLS = [
  { bin: "node", label: "Node.js 20+", required: true, group: "기반", install: { darwin: "brew install node", win32: "winget install OpenJS.NodeJS.LTS", linux: "https://nodejs.org" } },
  { bin: "git", label: "Git", required: true, group: "기반", install: { darwin: "brew install git", win32: "winget install Git.Git", linux: "apt install git" } },
  { bin: "codegraph", label: "CodeGraph (코드 인덱스)", required: true, group: "코어", install: { darwin: "curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh && codegraph install", win32: "irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex; codegraph install", linux: "curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh" } },
  { bin: "ooo", label: "Ouroboros (인터뷰·평가)", required: true, group: "코어", install: { darwin: "curl -fsSL https://raw.githubusercontent.com/Q00/ouroboros/main/install.sh | sh", win32: "irm https://raw.githubusercontent.com/Q00/ouroboros/main/install.ps1 | iex", linux: "curl -fsSL https://raw.githubusercontent.com/Q00/ouroboros/main/install.sh | sh" }, plugin: "/plugin marketplace add Q00/ouroboros && /plugin install ouroboros@ouroboros" },
  { bin: "ocr", label: "Open Code Review", required: true, group: "코어", install: npm("@alibaba-group/open-code-review") },
  { bin: "specify", label: "spec-kit (신규 프로젝트 스펙)", required: true, group: "코어", install: { darwin: "uv tool install specify-cli --from git+https://github.com/github/spec-kit.git", win32: "uv tool install specify-cli --from git+https://github.com/github/spec-kit.git", linux: "uv tool install specify-cli --from git+https://github.com/github/spec-kit.git" } },
  { bin: "openspec", label: "OpenSpec (기존 프로젝트 스펙)", required: true, group: "코어", install: npm("@fission-ai/openspec@latest") },
  { bin: "typst", label: "Typst (PDF)", required: true, group: "코어", install: { darwin: "brew install typst", win32: "winget install Typst.Typst", linux: "cargo install typst-cli" } },
  { bin: "gemini", label: "Gemini CLI (2차 의견)", required: true, group: "코어", install: npm("@google/gemini-cli") },
  { bin: "codex", label: "Codex CLI (2차 의견)", required: true, group: "코어", install: npm("@openai/codex"), plugin: "/plugin install codex@openai-codex" },
  { bin: "rtk", label: "rtk (토큰 절감)", required: false, group: "선택", install: { darwin: "brew install rtk", win32: "GitHub Releases에서 rtk-x86_64-pc-windows-msvc.zip 받아 PATH에 추가", linux: "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh" } },
  { bin: "uv", label: "uv (Python 도구 설치용)", required: false, group: "선택", install: { darwin: "brew install uv", win32: "winget install astral-sh.uv", linux: "curl -LsSf https://astral.sh/uv/install.sh | sh" } },
  { bin: "skillspector", label: "SkillSpector (스킬 보안 스캔)", required: false, group: "선택", install: { darwin: "uv tool install git+https://github.com/NVIDIA/skillspector.git", win32: "uv tool install git+https://github.com/NVIDIA/skillspector.git", linux: "uv tool install git+https://github.com/NVIDIA/skillspector.git" } },
  { bin: "strix", label: "Strix (앱 보안, Docker 필요)", required: false, group: "선택", install: { darwin: "curl -sSL https://strix.ai/install | bash", win32: "WSL2에서 curl -sSL https://strix.ai/install | bash", linux: "curl -sSL https://strix.ai/install | bash" } },
  { bin: "xelatex", label: "XeLaTeX (PDF LaTeX 옵션)", required: false, group: "선택", install: { darwin: "brew install --cask basictex", win32: "winget install MiKTeX.MiKTeX", linux: "apt install texlive-xetex" } },
  { bin: "flutter", label: "Flutter SDK", required: false, group: "스택", install: { darwin: "brew install --cask flutter", win32: "winget install Google.Flutter", linux: "https://docs.flutter.dev/get-started/install" } },
  { bin: "java", label: "JDK 21", required: false, group: "스택", install: { darwin: "brew install openjdk@21", win32: "winget install EclipseAdoptium.Temurin.21.JDK", linux: "apt install openjdk-21-jdk" } },
];

export const OFFICIAL_PLUGINS = ["skill-creator", "plugin-dev", "hookify", "mcp-server-dev", "claude-security", "security-guidance", "code-simplifier", "typescript-lsp", "jdtls-lsp", "kotlin-lsp"];
export const COMPANION_MARKETPLACES = [
  "thedotmack/claude-mem → /plugin install claude-mem (메모리)",
  "Q00/ouroboros → /plugin install ouroboros@ouroboros (인터뷰·평가)",
  "openai-codex → /plugin install codex@openai-codex (2차 의견)",
  "npx impeccable install (디자인)",
  "tt-a1i/archify (다이어그램)",
];

export function detect({ platform = process.platform, probe = (bin) => !!which(bin) } = {}) {
  const key = platform === "win32" ? "win32" : platform === "darwin" ? "darwin" : "linux";
  return TOOLS.map((t) => ({ bin: t.bin, label: t.label, required: t.required, group: t.group, present: probe(t.bin), installCmd: t.install[key], plugin: t.plugin ?? null }));
}

export function renderTable(rows) {
  const lines = ["| 도구 | 구분 | 상태 | 설치 명령 |", "|---|---|---|---|"];
  for (const r of rows) lines.push(`| ${r.bin} | ${r.required ? "필수" : r.group} | ${r.present ? "✅" : "❌"} | ${r.present ? "" : "`" + r.installCmd + "`"} |`);
  return lines.join("\n");
}

if (process.argv[1] && /detect\.mjs$/.test(process.argv[1])) {
  const rows = detect();
  process.stdout.write(renderTable(rows) + "\n\n");
  const missing = rows.filter((r) => !r.present);
  process.stdout.write(missing.length ? `미설치 ${missing.length}개: ${missing.map((m) => m.bin).join(", ")}\n` : "모든 도구 설치됨\n");
  if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(rows) + "\n");
}
