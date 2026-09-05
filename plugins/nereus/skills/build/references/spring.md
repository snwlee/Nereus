# Spring 테스트 세팅 (Gradle Kotlin DSL 기준)

```kotlin
dependencies {
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("io.rest-assured:rest-assured")
}
tasks.test { useJUnitPlatform() }
```
- 유닛: `src/test/java/.../XxxTest.java`, Mockito. 실행 `./gradlew test`
- 슬라이스: `@WebMvcTest`, `@DataJpaTest`. 전체 컨텍스트 `@SpringBootTest`는 최소화.
- Maven이면 `pom.xml`에 같은 의존을 `<scope>test</scope>`로.
