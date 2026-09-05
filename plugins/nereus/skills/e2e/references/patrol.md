# Flutter integration_test + Patrol
```yaml
dev_dependencies:
  integration_test: { sdk: flutter }
  patrol: ^3.0.0
patrol:
  app_name: <앱>
  android: { package_name: <id> }
  ios: { bundle_id: <id> }
```
```bash
dart pub global activate patrol_cli && patrol test
```
Patrol은 네이티브 권한 팝업(`$.native.grantPermissionWhenInUse()`), 알림, 웹뷰를 다룬다. 순수 Flutter 흐름은 `flutter test integration_test`로 충분. 에뮬레이터·시뮬레이터가 없는 머신에서는 스킵하고 리포트에 이유를 적는다.
