// 동반 플러그인 안내 — 확장이 선언하고 코어가 보여준다.
//
// 코어는 게임·모바일 같은 도메인을 모른다. "Unity 공식 플러그인을 깔면 좋다"는 지식은
// 게임 확장의 것이고, 여기서는 **데이터만** 받아 상태와 명령을 만든다.
//
// 명령은 선언에서 **유도한다.** 확장이 명령 문자열을 직접 적게 하면 id 와 명령이
// 서로 어긋나도 아무도 모른다 — 잘못된 명령은 실행되기 전까지 조용하다.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadExtensions } from "../../../hooks/scripts/lib/extensions.mjs";
import { readInventory } from "../../../hooks/scripts/lib/plugin-inventory.mjs";

/** `unity@unity-agent-plugin` → `unity-agent-plugin`. 마켓플레이스 이름은 id 의 뒷부분이다. */
const marketOf = (id) => id.split("@")[1] ?? id;

/**
 * 동반 플러그인별 상태와 다음 명령.
 *
 * 설치 여부는 인벤토리, 활성 여부는 설정이 진실이다 — 디스크에 있느냐가 아니다.
 * 관련성은 선언한 스택의 marker 가 현재 프로젝트에 있느냐로 본다.
 * **스택 선언을 못 찾으면 무관으로 단정하지 않는다** — 조용히 숨기면 설치할 수 있었다는
 * 사실 자체가 사라진다. 관련 있다고 보고 사유를 함께 낸다.
 */
export function companionRows({ companions = [], stacks = [], rows = [], cwd = process.cwd(), exists } = {}) {
  const has = exists ?? ((p) => { try { return fs.existsSync(p); } catch { return false; } });
  return companions.map((c) => {
    const installed = rows.find((r) => r.name === c.id);
    const market = marketOf(c.id);
    const scopeArg = `--scope ${c.scope}`;

    let status, commands;
    if (!installed) {
      status = "미설치";
      commands = [`claude plugin marketplace add ${c.marketplace}`, `claude plugin install ${c.id} ${scopeArg}`];
    } else if (installed.enabled === false) {
      status = "비활성";
      commands = [`claude plugin enable ${c.id}`];
    } else {
      status = `설치됨 ${installed.version ?? "?"}`;
      // 마켓을 먼저 갱신하지 않으면 `plugin update` 가 이미 받아둔 것과 같은 버전을 본다.
      commands = [`claude plugin marketplace update ${market}`, `claude plugin update ${c.id} ${scopeArg}`];
    }

    let relevant = true;
    let note = null;
    const wantStack = c.when?.stack;
    if (wantStack) {
      const decl = stacks.find((s) => s.name === wantStack);
      if (!decl) note = `스택 선언 '${wantStack}' 을 찾을 수 없어 관련성을 판정하지 못했다`;
      else relevant = has(path.join(cwd, decl.marker));
    }
    return { id: c.id, label: c.label, why: c.why, status, commands, relevant, note };
  });
}

/** 관련 있는 것만 표로. 실행은 사용자 승인 뒤에 SKILL 이 한다. */
export function renderCompanions(rows) {
  const shown = rows.filter((r) => r.relevant);
  if (!shown.length) return "이 프로젝트에 권할 동반 플러그인이 없다.";
  const lines = ["| 플러그인 | 상태 | 왜 | 다음 명령 |", "|---|---|---|---|"];
  for (const r of shown) {
    const cmds = r.commands.map((c) => `\`${c}\``).join("<br>");
    lines.push(`| ${r.id} | ${r.status} | ${r.why}${r.note ? ` (${r.note})` : ""} | ${cmds} |`);
  }
  lines.push("", "업데이트는 **재시작해야 적용된다**.");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const home = os.homedir();
  const pluginsFile = path.join(home, ".claude", "plugins", "installed_plugins.json");
  const settingsFile = path.join(home, ".claude", "settings.json");
  const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return undefined; } };
  const { companions, stacks } = loadExtensions({ pluginsFile, settingsFile });
  const rows = readInventory({ pluginsFile, settingsFile, readJson });
  process.stdout.write(renderCompanions(companionRows({ companions, stacks, rows })) + "\n");
}
