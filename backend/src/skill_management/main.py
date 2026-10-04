from fastapi import FastAPI

from skill_management.api import employees, health, skill_assignments, skills

app = FastAPI(title="Skill Management")
app.include_router(health.router)
app.include_router(employees.router)
app.include_router(skills.router)
app.include_router(skill_assignments.router)
