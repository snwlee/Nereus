# 역추적 (root cause tracing)

버그는 콜스택 깊은 곳에서 드러난다 — 엉뚱한 디렉터리에서 실행된 `git init`, 잘못된 위치에 생긴 파일, 틀린 경로로 열린 DB. 본능은 에러가 난 지점을 고치는 것이지만 그건 증상 치료다.

**원칙: 원래 트리거까지 거슬러 올라가 그 지점에서 고친다.**

## 언제

- 에러가 진입점이 아니라 실행 깊은 곳에서 난다
- 스택 트레이스의 호출 사슬이 길다
- 잘못된 값이 어디서 생겼는지 불분명하다
- 어느 테스트·코드가 문제를 유발하는지 찾아야 한다

## 절차

### 1. 증상을 관찰한다
```
Error: git init failed in ~/project/packages/core
```

### 2. 직접 원인을 찾는다
이 에러를 직접 만드는 코드는 무엇인가?
```ts
await execFileAsync("git", ["init"], { cwd: projectDir });
```

### 3. 누가 이걸 불렀는지 묻는다
```
WorktreeManager.createSessionWorktree(projectDir, sessionId)
  ← Session.initializeWorkspace()
  ← Session.create()
  ← 테스트의 Project.create()
```

### 4. 값을 들고 계속 올라간다
- `projectDir = ""` (빈 문자열)
- 빈 문자열을 `cwd` 로 주면 `process.cwd()` 로 해석된다
- 그게 소스 디렉터리였다

### 5. 원래 트리거를 찾는다
```ts
const context = setupCoreTest();          // 초기값 { tempDir: "" }
Project.create("name", context.tempDir);  // beforeEach 전에 접근
```
근본 원인: 최상위 변수 초기화가 아직 비어 있는 값을 읽었다.
수정: `tempDir` 을 getter 로 바꿔 beforeEach 전 접근 시 예외를 던지게 했다.

## 수동 추적이 안 될 때 — 계측한다

```ts
async function gitInit(directory: string) {
  const stack = new Error().stack;
  console.error("DEBUG git init:", { directory, cwd: process.cwd(), env: process.env.NODE_ENV, stack });
  await execFileAsync("git", ["init"], { cwd: directory });
}
```

- **테스트 안에서는 `console.error`** 를 쓴다. 로거는 억제될 수 있다.
- 실패한 **뒤**가 아니라 위험한 연산 **앞**에서 로그한다.
- 디렉터리·cwd·환경변수·타임스탬프를 함께 남긴다.
- `new Error().stack` 으로 호출 사슬 전체를 잡는다.

```bash
npm test 2>&1 | grep "DEBUG git init"
```
스택에서 테스트 파일 이름과 줄 번호를 찾아 패턴(같은 테스트? 같은 인자?)을 확인한다.

## 어느 테스트가 오염시키는지 이분 탐색

테스트 중에 무언가가 생기는데 어느 테스트인지 모를 때:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/debug/scripts/find-polluter.mjs" ".git" "tests/**/*.test.ts"
```
테스트를 하나씩 돌려 첫 오염 지점에서 멈춘다. `--cmd` 로 러너를 지정할 수 있다.

## 원칙

찾은 직접 원인에서 한 단계 위로 올라갈 수 있는가?
- 있다 → 올라간다. 여기가 출처인가? 아니면 또 올라간다.
- 없다(막다른 길) → 그 지점에서 고치되, **다층 방어**를 함께 넣는다(`defense-in-depth.md`).

출처에서 고친 뒤 각 층에 검증을 추가하면 그 버그는 구조적으로 불가능해진다.

**에러가 난 자리만 고치지 않는다.**
