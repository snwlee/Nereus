# Flutter 테스트 세팅

```yaml
# pubspec.yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  mocktail: ^1.0.0
  integration_test:
    sdk: flutter
```
- 유닛/위젯: `test/<feature>/<name>_test.dart`, 실행 `flutter test`
- 위젯 테스트는 `testWidgets` + `pumpWidget`. 상태 관리는 provider 주입으로 교체 가능하게.
- E2E는 `integration_test/` + Patrol (nereus:e2e 참조)
