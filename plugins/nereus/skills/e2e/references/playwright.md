# Playwright 세팅
```bash
npm i -D @playwright/test && npx playwright install --with-deps chromium
```
`playwright.config.ts`: `testDir: "e2e"`, `use: { trace: "retain-on-failure", screenshot: "only-on-failure" }`, `retries: 2`, `webServer`로 dev 서버 자동 기동.
테스트는 `page.getByRole`로 찾고, `await expect(locator).toBeVisible()`로 대기. 320/768/1440 뷰포트 프로젝트 3개.
