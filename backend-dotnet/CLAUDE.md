# backend-dotnet - mixed mode

Third backend next to `../backend/` (Python) and `../backend-spring/` (Java).
Goal: profile extension in modern .NET for a user who last used .NET Framework 4.
Time budget for the user: about 2 hours in total.

## Who writes what

| Round | Content                                                 | Author |
| ----- | ------------------------------------------------------- | ------ |
| 1     | Scaffold, `Program.cs`, `/health`, test setup           | Claude |
| 2     | EF Core entities, `DbContext`, migrations               | Claude (user found it too trivial) |
| 3     | Endpoints: skills, import, assignments, error handling  | Claude (port from `../backend-spring/`) |
| 4     | Employee search with LINQ (`GET /employees`)            | User (Claude provides the tests) |
| 5     | Dockerfile, CI job, Render deploy                       | Claude |

- In user rounds: do not write the user's part. Give hints, a skeleton and the
  tests; review when asked. Explain C# concepts by comparing them with TypeScript in chat,
  not as comments in code.
- Tests are the spec. Port them from `../backend-spring/src/test/` and
  `../backend/tests/`.

## Contract with the frontend

- Same paths, methods, status codes and validation as the other backends (NOTES.md)
- JSON in snake_case (`SnakeCaseLower`, set in `Program.cs`)
- Dev server on port 8000 without `/api` prefix

## Stack

.NET 10, ASP.NET Core Minimal APIs, EF Core with Npgsql (from round 2),
xUnit, `WebApplicationFactory`.

## Commands

| Task  | Command                                      |
| ----- | -------------------------------------------- |
| Run   | `dotnet run --project src/CompanySkills`     |
| Tests | `dotnet test`                                |
| Format | `dotnet format`                             |
