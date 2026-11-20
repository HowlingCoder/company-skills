# frontend-react

React variant of the frontend of the [Company Skill Management](../README.md) app.

It has the same features as the Angular frontend in [`../frontend/`](../frontend/):
employee table with row selection, search by name, skills and level (kept in the URL),
CSV import, editing the skills of one employee and assigning a skill to many. It runs in
the live demo together with the Spring backend.

It talks to the API under `/api`, so it will work with the Python and the Spring
backend alike.

## Stack

React 19, TypeScript, Vite, Mantine (only UI library), TanStack Query for server
state, Tabler icons. Tests: Vitest and React Testing Library.

## Run

Start a backend on http://localhost:8000 first, for example
`cd ../backend; uv run uvicorn skill_management.main:app --reload`. The Vite dev
server forwards `/api/*` to it with the prefix removed (see `vite.config.ts`).

```sh
npm install
npm run dev        # http://localhost:5173
```

| Task  | Command             |
| ----- | ------------------- |
| Tests | `npm test -- --run` |
| Build | `npm run build`     |
| Lint  | `npm run lint`      |

JSON field names from the API are snake_case (`skill_id`, `proficiency_level`).
