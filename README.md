# Company Brain

An evidence-backed engineering investigation dashboard powered by FalkorDB.

## Requirements and setup

- Node.js 22 LTS and npm.
- An existing, reachable hosted or remote FalkorDB instance. This project does not use Docker or a local database.

1. Copy `.env.example` to `.env` and set `FALKORDB_URL`, any required TLS setting, and credentials using the connection details from FalkorDB Cloud. Keep `FALKORDB_GRAPH=mygraph` to use the existing graph. Never commit `.env`; it is excluded by `.gitignore`.
2. From this folder, run `npm install`.
3. Run `npm run dev` to start the API and frontend together. Open `http://localhost:5173`. The API listens on `http://localhost:3001`; Vite proxies `/api` and `/health` to it.

The server checks that the configured graph already exists and does not create another graph. To run the server and frontend separately, use `npm run dev:server` and `npm run dev:client` in separate terminals. Check the database connection with `Invoke-RestMethod http://localhost:3001/health` after starting the server.


## Graph Data Model

Company Brain uses FalkorDB to represent engineering knowledge as a property graph.

**Node labels**
- `Incident` — incident ID, title, status, and investigation context.
- `Service` — service ID, name, and dependency information.
- `Engineer` — engineer ID and name.
- `Decision` — architecture decision ID and decision details.
- `Document` — document ID, title, and source metadata.

**Relationships**
- `(Incident)-[:AFFECTED]->(Service)` — connects an incident to an affected service.
- `(Engineer)-[:MAINTAINS]->(Service)` — identifies service ownership.
- `(Service)-[:DEPENDS_ON]->(Service)` — represents service dependencies.
- `(Incident)-[:RELATED_TO]->(Decision)` — links an incident to a potentially relevant decision; this does not imply causation.
- `(Decision)-[:AUTHORED]->(Engineer)` — identifies the decision author.
- `(Decision)-[:DOCUMENTED_IN]->(Document)` — links a decision to its source document.

The bundled graph contains synthetic demonstration records, not production evidence.

## Cypher Queries and Graph Traversal

The backend uses parameterized Cypher queries against FalkorDB. The query implementations are maintained in `server/src/graph/queries.ts`.

- **Expert Finder:** traverses incident-to-service and engineer-to-service relationships to identify relevant engineers and supporting evidence.
- **Incident Investigation:** retrieves an incident, its affected services, and directly linked decisions.
- **Decision Detective:** follows decision-to-author and decision-to-document relationships to retrieve decision context and provenance.
- **Blast Radius:** traverses `DEPENDS_ON` relationships to find connected services, with a configurable traversal depth from 1 to 8.

These traversals return connected records and evidence paths for the frontend. Dependency paths indicate potential impact, not confirmed service failures. Incident-to-decision relevance does not establish causation.

For implementation details, see `server/src/graph/queries.ts` and the corresponding route handlers in the server source.


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


## AI TOOL USED : CHATGPT