# 다층 방어 (defense in depth)

잘못된 데이터가 원인이었던 버그를 고칠 때, 한 곳에 검증을 넣으면 충분해 보인다. 하지만 그 한 곳은 다른 코드 경로, 리팩터링, 목(mock)에 의해 우회된다.

**원칙: 데이터가 지나가는 모든 층에서 검증한다. 버그를 구조적으로 불가능하게 만든다.**

검증 한 곳 = "버그를 고쳤다". 여러 층 = "버그가 불가능하다".

## 4개 층

### 1층. 진입점 검증
명백히 잘못된 입력을 API 경계에서 거부한다.
```ts
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory?.trim()) throw new Error("workingDirectory cannot be empty");
  if (!existsSync(workingDirectory)) throw new Error(`does not exist: ${workingDirectory}`);
  if (!statSync(workingDirectory).isDirectory()) throw new Error(`not a directory: ${workingDirectory}`);
}
```

### 2층. 비즈니스 로직 검증
이 연산에 대해 데이터가 의미가 있는지 확인한다.
```ts
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) throw new Error("projectDir required for workspace initialization");
}
```

### 3층. 환경 가드
특정 맥락에서 위험한 연산을 막는다.
```ts
if (process.env.NODE_ENV === "test") {
  const target = normalize(resolve(directory));
  if (!target.startsWith(normalize(resolve(tmpdir())))) {
    throw new Error(`테스트 중 임시 디렉터리 밖에서 git init 거부: ${directory}`);
  }
}
```

### 4층. 계측
사후 분석을 위한 맥락을 남긴다.
```ts
logger.debug("about to git init", { directory, cwd: process.cwd(), stack: new Error().stack });
```

## 적용

1. **데이터 흐름을 추적한다** — 나쁜 값이 어디서 생겨 어디까지 쓰이는가.
2. **통과 지점을 전부 나열한다.**
3. **각 층에 검증을 넣는다** — 진입점, 비즈니스 로직, 환경 가드, 계측.
4. **각 층을 개별로 시험한다** — 1층을 우회했을 때 2층이 잡는지 확인한다.

## 왜 전부 필요한가

실제 사례에서 네 층이 각각 다른 버그를 잡았다.
- 다른 코드 경로가 진입점 검증을 우회했다
- 목(mock)이 비즈니스 로직 검증을 우회했다
- 플랫폼별 엣지 케이스는 환경 가드가 필요했다
- 구조적 오용은 계측 로그로만 드러났다

**검증 한 곳에서 멈추지 않는다.**

## Nereus 주의

층을 추가하는 것은 가드를 추가하는 것이다. 완료 무결성 게이트는 **테스트 없는 가드 제거**(`guard_removed`)를 차단한다 — 반대로 가드를 넣을 때도 그 가드가 실제로 발화하는 부정 테스트를 함께 쓴다. 그러지 않으면 다음 사람이 조용히 지운다.
