# Skill Management

Web app for team leads: import employees via CSV, view them in a table,
assign skills with a proficiency level, search employees by skill and level.

**NOTES.md is the source of truth for requirements, data model and decisions.**
Read it before planning a change. If a task conflicts with NOTES.md, stop and ask.

## Structure

- `backend/` - Python, FastAPI, SQLAlchemy, Alembic, uv
- `frontend/` - Angular, Siemens Element
- `backend/data/skills.csv` - seed data for the skill catalog
- `backend/data/employees.csv` - sample file for the employee CSV import

## Commands

| Task           | Command                                                         |
| -------------- | --------------------------------------------------------------- |
| Database       | `docker compose up -d db` (host port 5433)                      |
| Backend dev    | `cd backend; uv run uvicorn skill_management.main:app --reload` |
| Backend tests  | `cd backend; uv run pytest`                                     |
| Backend lint   | `cd backend; uv run ruff check .`                               |
| Backend format | `cd backend; uv run ruff format .`                              |
| Migrations     | `cd backend; uv run alembic upgrade head`                       |
| Seed skills    | `cd backend; uv run seed-skills data/skills.csv`                |
| Frontend dev   | `cd frontend; npm start` (http://localhost:4200)                |
| Frontend tests | `cd frontend; npm test -- --watch=false`                        |
| Frontend lint  | `cd frontend; npm run lint`                                     |
| Frontend format | `cd frontend; npm run format`                                  |
| Full app image | `docker compose up --build` (http://localhost:8090)             |
| Hooks setup    | `uvx pre-commit install` (once per clone)                       |
| Hooks run all  | `uvx pre-commit run --all-files`                                |

Run tests and lint for the affected part after every change.

CI (`.github/workflows/ci.yml`) runs on every push to `main` and on pull requests:
backend lint and tests, frontend lint, tests and build, and a Docker build with a
smoke test. Keep its commands in sync with the table above.

The Docker image serves the API under `/api` and the built frontend under `/`
(`backend/src/skill_management/web.py`). On start it runs the migrations and the
skill seed, see `backend/docker-entrypoint.sh`.

The frontend calls the backend under `/api`. In development `frontend/proxy.conf.json`
forwards `/api/*` to `http://localhost:8000/*` (prefix removed), so the backend dev
server must be running.

## Conventions

- English for code, comments, UI text and docs
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`)
- Small, focused diffs - one concern per change
- No new dependencies without asking first
- Every feature comes with meaningful tests (behavior and error cases, not coverage)
- Errors: 4xx for client input problems, 5xx only for server faults

## Frontend: Siemens Element

Use Element components only, no other UI libraries.
Check the component docs before implementing: https://element.siemens.io/components/

| Need                      | Component                 |
| ------------------------- | ------------------------- |
| Skill autocomplete        | Typeahead                 |
| Skill badges              | Badges                    |
| Modals                    | Modals (`SiModalService`) |
| Table with row selection  | ngx-datatable             |
| CSV upload                | File uploader             |
| Empty table               | Empty state               |
| Conflict warning in modal | Inline notification       |
| Import result             | Toast notification        |
| Badge overflow            | Popover                   |

## Rules

- Plan first: describe the intended change and wait for approval before editing
- Never commit - the user reviews and commits all changes
- Never modify or delete tests to make them pass - fix the code or ask
- Never edit existing migrations; create a new one
- Read generated Alembic migrations; autogenerate misses functional indexes
- Do not implement anything listed under "Out of scope" in NOTES.md
