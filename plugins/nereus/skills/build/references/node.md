# Node/TS 테스트 세팅

```bash
npm i -D vitest @vitest/coverage-v8
```
```json
{ "scripts": { "test": "vitest run", "coverage": "vitest run --coverage" } }
```
- 파일: `src/**/*.test.ts` 또는 `tests/**/*.test.ts`. AAA(Arrange-Act-Assert) 구조.
- React면 `@testing-library/react` + `jsdom` 환경. 서버면 `supertest`.
- 커버리지 임계 80%를 `vitest.config.ts`의 `coverage.thresholds`에 둔다.
