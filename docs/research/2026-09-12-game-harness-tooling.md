# 게임 개발 하네스용 CLI·MCP 도구 조사

- 조사일: 2026-09-12
- 대상: 폰 게임(Unity) · Nintendo Switch(Unity) · 로블록스 유즈맵(Luau) 3스택 공용 하네스
- 커버 요구: 레벨 디자인 · 스토리 · UI/UX · 인게임 엔진 · 에셋(2D/3D/오디오)

## 1. 요약

1. **에셋 생성 층은 이미 성숙했다.** 3D는 Hunyuan3D-2.1(PBR)·TRELLIS·PartCrafter, 2D는 ComfyUI MCP 계열, 오디오는 ElevenLabs 공식 MCP + YuE2로 CLI/MCP 경로가 전부 열려 있다. 우리가 만들 것은 없고 *고르고 묶는* 일만 남았다.
2. **비어 있는 층은 두 개다.** 게임 밸런싱·이코노미 시뮬레이션, 그리고 2D 스켈레탈/오토리깅. 둘 다 쓸 만한 오픈소스를 찾지 못했다(없다고 단정하지는 않는다 — 확인 실패).
3. **요구한 전 도메인 커버 하네스가 이미 존재한다.** `Donchitos/Claude-Code-Game-Studios` ★24,985 — 49 에이전트 / 73 스킬 / 7단계 파이프라인으로 레벨·내러티브·UI/UX·아트·엔진을 전부 덮는다. 우리 설계는 이것을 기준선으로 잡고 차별점을 정해야 한다.

## 2. 질문과 답

### Q1. 2D 에셋(스프라이트·타일셋·UI 아이콘)을 CLI/MCP로 뽑을 수 있나
가능. 두 경로다.
- **로컬 파이프라인**: ComfyUI + MCP 브리지. `artokun/comfyui-mcp`가 가장 활발하고 "agent-native control plane"을 표방한다. 워크플로를 JSON으로 고정할 수 있어 **결정론적 재생성**이 되는 게 핵심 — 하네스 게이트에 넣으려면 이 성질이 필수다.
- **API 경로**: `zhongweili/nanobanana-mcp-server`(Gemini 이미지). 키가 필요하지만 설치가 가볍다. 우리는 이미 `nereus:image`가 Gemini 웹 세션을 쓰므로 중복 가능성이 있다.
- 편집·검수는 Aseprite(Lua 스크립팅 + CLI 배치) 또는 Pixelorama가 맡는다. 생성물 후처리(팔레트 고정, 시트 패킹)는 생성 모델이 아니라 여기서 한다.

### Q2. 3D는 게임엔진에 바로 넣을 수 있는 형태로 나오나
조건부로 가능.
- **PBR 머티리얼까지 나오는 건 Hunyuan3D-2.1이 유일**하다. 나머지는 메시만 나오거나 베이크가 필요하다.
- **PartCrafter**가 게임용으로 의외로 중요하다. 단일 메시가 아니라 **부위별로 분리된 메시**를 낸다 — 장비 교체, 파괴 표현, 애니메이션 본 배치가 전부 부위 분리를 전제하므로, 통짜 메시는 게임에 바로 못 쓴다.
- **Blender MCP(★28k)가 실질적인 허브**다. 생성 모델 출력 → Blender에서 리토폴로지·UV·스케일 정규화·포맷 변환 → 엔진. 이 중간 단계 없이는 생성 3D는 게임에 안 들어간다. 헤드리스가 필요하면 `sandraschi/blender-mcp`(FastMCP 기반)를 본다.
- **오토리깅 오픈소스 CLI는 찾지 못했다.** 현재로선 수동 또는 상용(Mixamo/Anything World) 의존.

### Q3. 오디오는
- **ElevenLabs 공식 MCP(★1536)** 가 보이스·SFX 양쪽에서 가장 실용적. 유료지만 유일하게 "그냥 된다".
- 로컬 음악은 **YuE2**(apache-2.0, 심볼릭 플래닝 + 에이전틱 편집)가 가장 활발. `ace-step-ui`는 Suno 대체 UI.
- **audio.cpp**(ggml 기반 순수 C++ 추론, TTS/STT/보이스 변환)가 라이선스·오프라인 요건이 빡센 경우의 답.

### Q4. 레벨 디자인은 자동화되나
부분적으로만.
- **결정론적 절차 생성은 고전이 답이다.** WaveFunctionCollapse(★25k)·MarkovJunior(★8k). LLM이 필요 없고, 시드가 같으면 결과가 같아 **테스트 가능**하다. 하네스 게이트에 넣기 좋다.
- LLM 기반 레벨 생성은 연구 단계고 쓸 만한 도구가 없다. `RobDavenport/grammex`(그래프 재작성 + 게임 제약 의미론)가 방향은 맞지만 ★2로 초기.
- **밸런싱·이코노미 시뮬레이션 도구는 사실상 없다**(검색 결과 전부 ★0). 이 층은 직접 만들어야 한다 — 그리고 만들 가치가 가장 큰 층이다.

### Q5. 스토리·내러티브는
- **Yarn Spinner(★2840, MIT, 엔진 불가지론)** 가 사실상 업계 표준이고, Unity·Godot·Unreal 런타임이 다 있다. **대사를 `.yarn` 텍스트 파일로 두면 git·diff·리뷰·테스트가 전부 평범한 코드처럼 된다** — 하네스 관점에서 이게 결정적이다.
- 분기 설계 시각화는 `mhgolkar/Arrow`(★1347, MIT).
- `zenstory-ai/novel-to-game`(★776)은 Claude Code Agent Skills 형식이라 패키징 참고용으로 가치가 있다.

### Q6. 게임 UI/UX는 웹과 뭐가 다른가
축이 다르다 — 게임 UI는 **입력 장치(터치/조이콘/마우스)·해상도(휴대/거치)·안전영역·게임패드 포커스 이동**이 1급 제약이고, 웹의 시맨틱 HTML/접근성 트리가 없다. 따라서 `nereus:design`의 Gemini 렌더 비평은 그대로 쓰되 **체크리스트를 갈아야** 한다.
- Figma 연동은 `awdr74100/figwright`(★737, 양방향) 또는 `grab/cursor-talk-to-figma-mcp`(★7007).
- 로블록스는 UI가 코드(Luau)라 웹과 가장 가깝고, Unity UI Toolkit도 UXML/USS라 텍스트 기반이다. 즉 **세 스택 전부 UI가 텍스트로 존재**한다 — 자동 리뷰가 가능하다는 뜻이다.

## 3. 비교표

### 3D 에셋
| 도구 | ★ | 최종 커밋 | 라이선스 | 게임 적합성 | 비고 |
|---|---|---|---|---|---|
| ahujasid/blender-mcp | 28,265 | 2026-09-07 | MIT | ★★★ 허브 | 생성물→엔진 사이 필수 경유지 |
| microsoft/TRELLIS | 13,626 | 2026-06-26 | MIT | ★★ | 품질 최상, PBR 없음 |
| Tencent-Hunyuan/Hunyuan3D-2.1 | 4,013 | 2025-10-17 | other(비표준) | ★★★ | **PBR 나오는 유일** / 라이선스 검토 필요 |
| wgsxm/PartCrafter | 2,477 | 2026-04-16 | MIT | ★★★ | **부위 분리 메시** — 장비·파괴·리깅 전제 |
| ZiYang-xie/WorldGen | 2,132 | 2026-04-12 | Apache-2.0 | ★★ | 씬 통째. 프로토타입용 |
| meshy-dev/meshy-mcp-server | 45 | 2026-08-22 | MIT | ★★ | 상용 API, 벤더 공식 |

### 2D 에셋
| 도구 | ★ | 최종 커밋 | 라이선스 | 비고 |
|---|---|---|---|---|
| aseprite/aseprite | 39,390 | 2026-09-10 | 유료(소스공개) | Lua 스크립팅 + CLI 배치. 후처리 담당 |
| Orama-Interactive/Pixelorama | 10,290 | 2026-09-10 | MIT | Aseprite 무료 대안 |
| ATH-MaaS/Pixelle-MCP | 1,108 | 2025-12-17 | MIT | ComfyUI+MCP+LLM 통합. **커밋 정체** |
| artokun/comfyui-mcp | 740 | 2026-09-10 | MIT | ★★★ 가장 활발. 결정론적 워크플로 |
| zhongweili/nanobanana-mcp-server | 399 | 2026-05-18 | MIT | Gemini 이미지, 4K |

### 오디오
| 도구 | ★ | 최종 커밋 | 라이선스 | 비고 |
|---|---|---|---|---|
| elevenlabs/elevenlabs-mcp | 1,536 | 2026-08-20 | MIT | ★★★ 공식. 보이스+SFX. 유료 |
| open-mmlab/Amphion | 10,286 | 2026-03-25 | MIT | 연구용 툴킷, 무겁다 |
| multimodal-art-projection/YuE2 | 6,945 | 2026-09-11 | Apache-2.0 | ★★★ 로컬 음악 생성 최활발 |
| 0xShug0/audio.cpp | 2,604 | 2026-09-12 | other | 순수 C++ 추론. 오프라인 요건용 |

### 내러티브 · 레벨
| 도구 | ★ | 최종 커밋 | 라이선스 | 비고 |
|---|---|---|---|---|
| YarnSpinnerTool/YarnSpinner | 2,840 | 2026-09-07 | MIT | ★★★ 표준. 텍스트 기반 = git·테스트 가능 |
| mhgolkar/Arrow | 1,347 | 2025-09-05 | MIT | 분기 시각화. 커밋 정체 |
| mxgmn/WaveFunctionCollapse | 25,319 | 2026-09-11 | - | ★★★ 결정론적 = 게이트 가능 |
| mxgmn/MarkovJunior | 8,188 | 2026-09-11 | - | 제약 전파 기반 생성 |

### 경쟁 하네스 (기준선)
| 도구 | ★ | 라이선스 | 형태 | 커버 |
|---|---|---|---|---|
| **Donchitos/Claude-Code-Game-Studios** | **24,985** | MIT | 템플릿 레포 | 49 에이전트/73 스킬, 7단계, Godot·Unity·UE5 |
| striderZA/OpenCodeGameStudios | 85 | MIT | 프레임워크 | 위의 OpenCode 파생. 52 에이전트/77 커맨드 |
| leigest519/OpenGame | 2,920 | - | 논문+프레임워크 | 웹게임 한정. Template/Debug Skill, OpenGame-Bench |
| sonic7881963/gamedev-skills | 1 | - | CC 스킬 | Godot 헤드리스 테스트·티어 워크플로 |

## 4. 추천

### 도구 선정
- **3D**: Hunyuan3D-2.1(PBR) + PartCrafter(부위분리) → **Blender MCP를 필수 경유지로** → 엔진
- **2D**: artokun/comfyui-mcp(결정론적 워크플로) → Aseprite CLI 후처리
- **오디오**: ElevenLabs MCP(보이스·SFX) + YuE2(BGM, 로컬)
- **내러티브**: Yarn Spinner를 **단일 진실 소스**로. `.yarn` 파일이 git에 들어가고 리뷰·테스트 대상이 된다
- **레벨**: WFC/MarkovJunior(결정론적) + 밸런싱 시뮬레이터는 **자체 제작**
- **UI/UX**: figwright(Figma 양방향) + `nereus:design` 게이트의 체크리스트를 게임용으로 교체

### 구조: 별도 플러그인, 같은 마켓플레이스
이 레포는 이미 `plugins/nereus`, `plugins/credstore` 두 플러그인을 담은 마켓플레이스다. 게임 하네스는 **`plugins/nereus-game`** 으로 세 번째 플러그인이 되어야 한다.

근거:
1. **스킬맵 오염.** SessionStart가 매 컨텍스트에 스킬맵을 주입한다. 현재 nereus 스킬 23개 + 에이전트 10개. 게임 도메인(레벨·내러티브·아트·오디오)을 합치면 두 배가 되고, **웹/앱 작업 중에도 게임 스킬이 라우팅 후보로 섞인다.** 스킬 라우팅은 목록이 길수록 나빠진다.
2. **수명주기가 다르다.** Nereus의 단위는 "기능"이고 finish는 커밋·아카이브다. 게임의 단위는 "빌드 → 플레이테스트 → 튜닝"이고 finish는 롤아웃·지표 관측이다. 같은 게이트에 넣으면 둘 다 망가진다.
3. **공유해야 할 것은 이미 플러그인 경계로 배포된다.** intake/spec/build/review/finish 골격, Baton, plan.mjs, learn, 훅 — 게임 플러그인이 nereus를 companion으로 의존하면 된다. ouroboros·codex와 같은 관계다.
4. **CCGS가 반례가 아니라 근거다.** ★25k짜리가 49 에이전트로 게임 도메인만 다룬다. 도메인 크기가 실제로 그만큼이라는 뜻이고, 범용 하네스에 밀어 넣을 크기가 아니다.

### 차별점 (CCGS 대비)
CCGS는 **에이전트 조율**에 집중하고 외부 도구 체이닝·자동 검증이 약하다(MCP 연동·에셋 생성 통합이 문서에 없다). 우리 차별점은 셋:
1. **실행 게이트** — Nereus의 TDD/증거 게이트를 그대로 상속. CCGS는 리뷰 강도가 full/lean/solo 선택제라 강제력이 없다
2. **에셋 파이프라인 통합** — 위 도구 체인을 스킬로 묶는다. CCGS에 없는 층
3. **3스택 어댑터** — 로블록스(Open Cloud Luau Execution)·Unity·Switch(NDA 경계). CCGS는 Godot/Unity/UE5만

### 리스크
- **Hunyuan3D 라이선스가 표준 OSS가 아니다.** 상용 출시 전 조항 확인 필수
- **밸런싱 층은 선행 사례가 없다.** 직접 설계해야 하고 가장 불확실하다
- **오토리깅·2D 스켈레탈 공백** — 상용 도구 의존을 전제하거나 범위에서 뺀다
- ComfyUI 의존은 로컬 GPU를 전제한다. macOS에서 3D 생성 모델 대부분이 느리거나 안 돈다

## 5. 출처

모두 2026-09-12 확인.

- https://github.com/Donchitos/Claude-Code-Game-Studios
- https://github.com/striderZA/OpenCodeGameStudios
- https://github.com/leigest519/OpenGame · https://arxiv.org/abs/2604.18394
- https://github.com/ahujasid/blender-mcp
- https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
- https://github.com/microsoft/TRELLIS
- https://github.com/wgsxm/PartCrafter
- https://github.com/artokun/comfyui-mcp
- https://github.com/ATH-MaaS/Pixelle-MCP
- https://github.com/elevenlabs/elevenlabs-mcp
- https://github.com/multimodal-art-projection/YuE2
- https://github.com/YarnSpinnerTool/YarnSpinner
- https://github.com/mhgolkar/Arrow
- https://github.com/mxgmn/WaveFunctionCollapse · https://github.com/mxgmn/MarkovJunior
- https://github.com/awdr74100/figwright · https://github.com/grab/cursor-talk-to-figma-mcp
- https://github.com/meshy-dev/meshy-mcp-server
- https://create.roblox.com/docs/cloud/reference/features/luau-execution

## 6. 검증 추가분 (2026-09-12 2차 확인)

1차 조사 후 아카이브·후속 확인을 돌린 결과 아래 셋이 **탈락**했다. 본문의 해당 추천은 무효다.

| 탈락 | 사유 | 대체 |
|---|---|---|
| `Roblox/studio-rust-mcp-server` | **아카이브.** README가 Studio **내장 MCP 서버**로 이전하라고 명시 | **Roblox Studio 내장 MCP** (Assistant ⟩ … ⟩ Manage MCP Servers). 스크립트 편집·에셋 생성·Luau 실행·**플레이테스트(플레이 시작/정지, 스크린샷, 입력 시뮬)**·API 문서·다중 Studio 세션까지 전부 내장. 서드파티 Roblox MCP가 **전부 불필요해졌다** |
| `elevenlabs/elevenlabs-mcp` | **아카이브.** 로컬 MCP 폐기 | **호스티드 MCP** `https://api.elevenlabs.io/v1/mcp` (OAuth, 설치 없음) + `elevenlabs/skills`(MIT ★447) + `elevenlabs/cli`(MIT) |
| `Roblox/place-ci-cd-demo` | **아카이브**(2024-09-17). 본인들도 "battle tested 아님" 경고 | 의존하지 않고 **CI 형태의 청사진으로만** 참조: Selene → StyLua → Rojo 빌드 → 업로드 → Luau Execution → 배포 |

라이선스 실물 확인:
- `mxgmn/WaveFunctionCollapse` → GitHub 분류는 NOASSERTION 이나 LICENSE 원문은 **MIT**. 채택 가능
- `AnkleBreaker-Studio/unity-mcp-*` → **자체 "AnkleBreaker Open License v1.0"**. OSI 아님. 조항 검토 전 채택 보류
- `Tencent-Hunyuan/Hunyuan3D-2.1` → NOASSERTION. Tencent 자체 라이선스, 상용 조항 확인 필요
- `alttester/AltTester-Unity-SDK` → **GPL-3.0**. SDK를 게임 빌드에 심는 구조라 상용 게임에 전염 위험. 비GPL UPM 패키지 별도 경로 필요
- MPL-2.0 계열(rojo·StyLua·selene·wally·lune) → 파일 단위 카피레프트. **CLI 바이너리 호출만 하면 무관**. 우리 용법은 안전
