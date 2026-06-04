FROM maven:4.0.0-rc-5-eclipse-temurin-25 AS build
WORKDIR /workspace
COPY packages/api/pom.xml .
COPY packages/api/src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /workspace/target/ai-clash-api-0.1.0.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
