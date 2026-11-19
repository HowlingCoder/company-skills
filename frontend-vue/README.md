# frontend-vue

Vue variant of the frontend of the [Company Skill Management](../README.md) app. It
rebuilds the Angular frontend in [`../frontend/`](../frontend/) with the same
features: employee table, CSV import, skill assignment and skill search.

It talks to the API under `/api`, so it works with the Python and the Spring
backend alike.

## Stack

Vue 3 (`<script setup lang="ts">`), TypeScript, Vite, Pinia, PrimeVue 5, Vitest,
Playwright. PrimeVue is the only UI library.

## Run

Start a backend on http://localhost:8000 first, for example
`cd ../backend; uv run uvicorn skill_management.main:app --reload`. The Vite dev
server forwards `/api/*` to it with the prefix removed (see `vite.config.ts`).

```sh
npm install
npm run dev        # http://localhost:5173
```

With Docker, from the repository root (Open http://localhost:8091):

```sh
docker compose up --build api-python web-vue
```

## Checks

| Task       | Command                      |
| ---------- | ---------------------------- |
| Unit tests | `npm run test:unit -- --run` |
| E2E tests  | `npm run test:e2e`           |
| Build      | `npm run build`              |
| Lint       | `npm run lint`               |
| Format     | `npm run format`             |

Node.js 22.18 or newer is required (see `engines` in `package.json`).

## Layout

```
src/api/         Plain fetch calls and types for the /api endpoints
src/stores/      Pinia stores
src/employees/   Overview table, filter bar, dialogs
src/skills/      Skill picker and skill badges
src/theme/       Theme and color tokens
```

JSON field names from the API are snake_case (`skill_id`, `proficiency_level`).
