# The Python API on its own, without the frontend. Build context: the repository root
# (see compose.yaml). Used together with a frontend image that forwards /api to it.
# The all-in-one image is the Dockerfile in the repository root.
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

COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"
RUN useradd --system --uid 1001 app
USER app

EXPOSE 8000
# The entrypoint migrates and seeds, then runs this command. The routes have no /api
# prefix: the frontend image removes it.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "skill_management.main:app", "--host", "0.0.0.0", "--port", "8000"]
