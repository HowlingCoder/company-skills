# The .NET API. Build context: the repository root (see compose.yaml), because the
# seed file lives in backend/data. Used together with a frontend image that forwards
# /api to it; the routes have no /api prefix.

# --- Stage 1: build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /build

# Restore first: this layer is reused as long as the project file is unchanged
COPY backend-dotnet/src/CompanySkills/CompanySkills.csproj src/CompanySkills/
RUN dotnet restore src/CompanySkills/CompanySkills.csproj

COPY backend-dotnet/src src
RUN dotnet publish src/CompanySkills/CompanySkills.csproj --configuration Release --no-restore --output /app

# --- Stage 2: run
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
COPY backend/data/skills.csv data/skills.csv

# Migrate and seed the skill catalog on every start (both are safe to repeat)
ENV ASPNETCORE_HTTP_PORTS=8000 \
    Database__MigrateOnStartup=true \
    Skills__SeedFile=/app/data/skills.csv
# Non-root user of the base image
USER $APP_UID

EXPOSE 8000
ENTRYPOINT ["dotnet", "CompanySkills.dll"]
