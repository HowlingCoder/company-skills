# The Spring API. Build context: the repository root (see compose.yaml), because the
# seed file lives in backend/data. Used together with a frontend image that forwards
# /api to it; the routes have no /api prefix.

# --- Stage 1: build the jar
FROM eclipse-temurin:21-jdk AS build
WORKDIR /build

# Dependencies first: this layer is reused as long as the pom is unchanged
COPY backend-spring/mvnw backend-spring/pom.xml ./
COPY backend-spring/.mvn .mvn
RUN chmod 755 mvnw && ./mvnw --batch-mode --quiet dependency:go-offline

COPY backend-spring/src src
RUN ./mvnw --batch-mode --quiet package -DskipTests

# --- Stage 2: run it
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
COPY backend/data/skills.csv data/skills.csv

# Flyway migrates on start; this seeds the skill catalog (inserts only, safe to repeat)
ENV SKILLS_SEED_FILE=/app/data/skills.csv
RUN useradd --system --uid 1001 app
USER app

EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]
