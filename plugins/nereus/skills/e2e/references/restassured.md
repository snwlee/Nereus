# Spring REST Assured + Testcontainers
```kotlin
testImplementation("io.rest-assured:rest-assured:5.+")
testImplementation("org.testcontainers:junit-jupiter")
testImplementation("org.testcontainers:postgresql")
```
`@SpringBootTest(webEnvironment = RANDOM_PORT)` + `@Testcontainers` + `@Container static PostgreSQLContainer<?> db`. `@DynamicPropertySource`로 datasource 주입. 테스트 이름은 `*E2ETest`. Docker가 없으면 스킵하고 리포트에 적는다.
