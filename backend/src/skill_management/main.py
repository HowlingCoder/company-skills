from fastapi import FastAPI

from skill_management.api import health

app = FastAPI(title="Skill Management")
app.include_router(health.router)
