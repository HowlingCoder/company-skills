"""Entry point of the Docker image: the API under /api, the built frontend under /.

In development the Angular dev server proxies /api to the API, so main.py is
served on its own there. The image has no proxy, so this app plays that role.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from skill_management.config import settings
from skill_management.main import app as api


def create_app(frontend_dir: Path | None = None) -> FastAPI:
    # The API keeps its own docs under /api/docs; this wrapper has no routes
    web = FastAPI(
        title="Company Skill Management",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    # Order matters: the frontend mount at / would otherwise catch /api too
    web.mount("/api", api)
    web.mount(
        "/",
        StaticFiles(directory=frontend_dir or settings.frontend_dir, html=True),
        name="frontend",
    )
    return web
