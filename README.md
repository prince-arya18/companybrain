# Company Brain

An evidence-backed engineering investigation dashboard powered by FalkorDB.

## Requirements and setup

- Node.js 22 LTS and npm.
- An existing, reachable hosted or remote FalkorDB instance. This project does not use Docker or a local database.

1. Copy `.env.example` to `.env` and set `FALKORDB_URL`, any required TLS setting, and credentials using the connection details from FalkorDB Cloud. Keep `FALKORDB_GRAPH=mygraph` to use the existing graph. Never commit `.env`; it is excluded by `.gitignore`.
2. From this folder, run `npm install`.
3. Run `npm run dev` to start the API and frontend together. Open `http://localhost:5173`. The API listens on `http://localhost:3001`; Vite proxies `/api` and `/health` to it.

The server checks that the configured graph already exists and does not create another graph. To run the server and frontend separately, use `npm run dev:server` and `npm run dev:client` in separate terminals. Check the database connection with `Invoke-RestMethod http://localhost:3001/health` after starting the server.

## Investigation features

- Incident Investigation: runs the incident context query, Expert Finder, then Decision Detective only for directly linked decisions and Blast Radius for returned affected service IDs.
- Expert Finder: `GET /api/experts/:incidentId`
- Incident context: `GET /api/incidents/:incidentId/context` returns the incident, `AFFECTED` service paths, and any direct Incident-to-Decision relationship paths.
- Decision Detective: `GET /api/decisions/:decisionId`
- Blast Radius: `GET /api/blast-radius/:serviceId?depth=5` (depth 1–8, default 5)

The frontend renders returned result fields, graph paths, relationships, and source evidence from the API. It does not supply mock feature results.

The bundled graph records are synthetic demo scenario data, not production evidence. The ADR document is an internal demo artifact without an external URL. Its Incident-to-Decision `RELATED_TO` edge denotes curated relevance only and does not assert causation or resolution.

## Development checks

- `npm run typecheck` checks both server and client TypeScript.
- `npm run build` builds both workspaces.
- `npm test` runs the server's read-only integration and route tests against the configured FalkorDB graph. These tests do not seed or mutate data. Seed demo records separately only when desired; the seed script uses deterministic IDs and `MERGE`.
