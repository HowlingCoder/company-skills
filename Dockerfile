# --- Stage 1: build the Angular frontend
FROM node:24-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: the backend, which also serves the built frontend
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app

# Dependencies first: this layer is reused as long as the lock file is unchanged
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/src ./src
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
COPY backend/data/skills.csv ./data/skills.csv
RUN uv sync --frozen --no-dev

COPY --from=frontend /build/dist/frontend/browser ./frontend
# chmod as its own step: COPY --chmod needs BuildKit, this also works with the classic builder
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH" \
    FRONTEND_DIR=/app/frontend
RUN useradd --system --uid 1001 app
USER app

EXPOSE 8000
ENTRYPOINT ["docker-entrypoint.sh"]
