FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /workspace
COPY backend/pom.xml backend/pom.xml
COPY backend/src backend/src
WORKDIR /workspace/backend
RUN mvn package -DskipTests -q

FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
COPY --from=build /workspace/backend/target/quarkus-app/lib/ /app/lib/
COPY --from=build /workspace/backend/target/quarkus-app/*.jar /app/
COPY --from=build /workspace/backend/target/quarkus-app/app/ /app/app/
COPY --from=build /workspace/backend/target/quarkus-app/quarkus/ /app/quarkus/
EXPOSE 8080
CMD ["java", "-jar", "quarkus-run.jar"]
