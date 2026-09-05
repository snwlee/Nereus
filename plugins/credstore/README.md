# credstore 플러그인

CredStore MCP 서버를 Claude Code에 등록하는 얇은 껍데기입니다. 소스는 `~/workspace/CredStore` (공개 저장소 https://github.com/snwlee/CredStore 예정).

`.mcp.json`은 `npx -y credstore mcp`를 기동합니다. 이 명령은 CredStore가 **npm에 게시된 뒤** 동작합니다. 게시 전 사용법:

```bash
cd ~/workspace/CredStore && npm run build && npm link   # 로컬 링크 → `credstore mcp` 사용 가능
```
그 다음 프로젝트 `.mcp.json`에 `{"mcpServers":{"credstore":{"command":"credstore","args":["mcp"]}}}` 로 등록하세요.

게시 절차(소유자): `npm login` → `cd ~/workspace/CredStore && npm publish`. GitHub에 올린 뒤에는 `npx -y github:snwlee/CredStore mcp`도 대안입니다(`prepare` 빌드 필요).
