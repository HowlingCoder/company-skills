#!/bin/sh
# Start of the Docker image: bring the database up to date, then serve.
# Both preparation steps are repeatable, so a restart changes nothing.
set -e

alembic upgrade head
seed-skills data/skills.csv

exec uvicorn skill_management.web:create_app --factory --host 0.0.0.0 --port 8000
