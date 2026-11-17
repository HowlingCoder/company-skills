#!/bin/sh
# Start of the Docker image: bring the database up to date, then serve.
# Both preparation steps are repeatable, so a restart changes nothing.
set -e

alembic upgrade head
seed-skills data/skills.csv

# Without arguments the all-in-one image serves the API and the frontend. A command
# passed by the caller (see backend/Dockerfile) replaces that default.
if [ "$#" -eq 0 ]; then
  set -- uvicorn skill_management.web:create_app --factory --host 0.0.0.0 --port 8000
fi

exec "$@"
