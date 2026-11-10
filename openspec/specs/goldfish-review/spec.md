# goldfish-review

설계 문서를 대화 맥락 없는 서브에이전트로 리뷰하고, 문서와 코드의 어긋남을 판정한다.
진입점: `plugins/nereus/skills/goldfish/scripts/goldfish.mjs`, `plugins/nereus/skills/drift/scripts/drift.mjs`.
출처: google/elephant-goldfish-model (Apache-2.0), commit 6d2af49.

Last verified: 2026-11-10

## Purpose

문서를 쓴 맥락은 자기 가정을 검증해 버린다. Goldfish 리뷰는 build 전에 그 틈을 찾고, drift 는 체크인된 스펙이 코드에서 멀어진 곳을 찾는다.

## Requirements
