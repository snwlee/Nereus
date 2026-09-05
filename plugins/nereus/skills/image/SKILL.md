---
name: image
description: Gemini로 이미지(앱 아이콘, 배너, 스토어 이미지, 목업, 일러스트)와 텍스트를 생성. macOS는 로그인된 Chrome 세션으로 무료, Windows/Linux는 GEMINI_API_KEY 또는 쿠키 수동 저장. "/nereus:image", "이미지 만들어", "아이콘 생성", "배너", "목업 그려" 요청 시 사용.
---

# image

## 실행 (스크립트를 쓴다. 클라이언트를 직접 짜지 않는다)
```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/image/scripts/gemini_cli.py"
python3 "$S" models                                        # 모델·쿼터
python3 "$S" ask   --prompt "..."                          # 텍스트
python3 "$S" image --prompt-file p.txt --file ref.png --out ./out --name icon   # 이미지
python3 "$S" image ... --backend api                        # API 강제
python3 "${CLAUDE_PLUGIN_ROOT}/skills/image/scripts/chrome_cookies.py"          # (macOS) 쿠키 갱신
python3 "${CLAUDE_PLUGIN_ROOT}/skills/image/scripts/remove_watermark.py" out/icon.png  # 워터마크 인페인팅
```
첫 실행 시 venv(`<nereus 설정 디렉터리>/cache/gemini-venv`)를 만들고 `gemini_webapi`, `google-genai`를 설치한다. `browser_cookie3`는 Keychain 프롬프트에 걸리므로 절대 설치하지 않는다.

## 백엔드 (`--backend auto|web|api`, 설정 `image.backend`)
- **web**: 로그인된 Gemini 웹 세션. 무료. macOS에서 Chrome 쿠키(`__Secure-1PSID`, `__Secure-1PSIDTS`)를 자동으로 읽고, 세션이 죽으면 스스로 다시 읽는다.
- **api**: `GEMINI_API_KEY`로 google-genai 호출. 이미지 모델 `gemini-2.5-flash-image`. 소액 과금.
- **auto**: macOS→web, 그 외→키 있으면 api, 없으면 쿠키 파일이 있을 때만 web, 아니면 안내 후 종료. Windows Chrome은 App-Bound Encryption으로 쿠키 자동 추출이 안 된다.
- 쿠키 파일 위치: macOS `~/.config/nereus/secrets/gemini-web-cookies.json`, Windows `%APPDATA%\nereus\secrets\...`. 이 파일은 시크릿이다. 내용을 출력하지 않는다.

## 운영 지식 (실측)
- **세션 사망**: `SESSION DEAD`로 종료 코드 2. Chrome에서 gemini.google.com 로그인 상태를 확인. 여러 이미지를 만들 때는 한 프로세스 안에서(재인증 반복 방지).
- **공인 인물 거부는 비결정적**: 같은 프롬프트·첨부가 두 번 실패하고 세 번째 성공한 적 있음. 프롬프트를 바꾸지 말고 재시도(`--retries` 기본 5). 전부 실패하면 실패라고 보고한다.
- **첨부는 슬롯 수만큼**: 아이콘(폰 1개)은 첫 첨부만 쓰고, 배너(폰 3개)는 3개를 쓴다.
- **워터마크**: 모든 생성 이미지 우하단에 스파클 마크. 위치가 매번 바뀌므로 고정 박스로 지우지 말 것. 권장은 디자인 단계에서 그 구석에 배지나 여백을 예약해 **덮는 것**. 인페인팅은 평면 배경에서만 깨끗하다. SynthID 비가시 워터마크는 어떤 방법으로도 남으니 "깨끗하다"고 말하지 않는다.
- 출력 타입 `GeneratedImage`(생성)와 `WebImage`(웹에서 가져온 사진)를 구분한다. "generate"라는 말이 없으면 후자가 올 수 있다.
