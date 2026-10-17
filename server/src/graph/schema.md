# Company Brain graph schema (v1)

All entity nodes use stable `id` values. Seed operations use `MERGE` on these IDs so repeated runs are reproducible.

| Node | Properties |
| --- | --- |
| `Engineer` | `id`, `name`, `skills`, `provenance` |
| `Team` | `id`, `name`, `provenance` |
| `Project` | `id`, `name`, `description`, `provenance` |
| `Service` | `id`, `name`, `provenance` |
| `Incident` | `id`, `title`, `severity`, `summary`, `provenance` |
| `Decision` | `id`, `title`, `summary`, `provenance` |
| `Document` | `id`, `title`, `uri`, `excerpt`, `provenance` |
| `CompanyBrainSchema` | `id`, `version` |

| Relationship | Direction and properties |
| --- | --- |
| `MEMBER_OF` | `(Engineer) -> (Team)` |
| `WORKS_ON` | `(Engineer) -> (Project)` |
| `MAINTAINS` | `(Engineer) -> (Service)` |
| `AFFECTED` | `(Incident) -> (Service)` |
| `RELATED_TO` | `(Incident) -> (Decision)`, `basis`; curated relevance association, not a causal or resolution claim |
| `RESOLVED` | `(Engineer) -> (Incident)`, `outcome` |
| `DEPENDS_ON` | `(Service) -> (Service)`, `criticality` |
| `AUTHORED` | `(Engineer) -> (Decision)` |
| `DOCUMENTED_IN` | `(Decision) -> (Document)`, `excerpt` |

All records in the demo scenario carry a `provenance` value identifying them as synthetic; `doc-001` is an internal demo artifact without an external URL. The seeded `inc-2025-042` is a separate synthetic resolved incident used as Expert Finder history. `RELATED_TO.basis = curated-relevance-only` labels contextual relevance and makes no causal or resolution claim. These labels describe demo scenario records, not production evidence.

Schema bootstrap, feature queries, seed queries, and health query execute against FalkorDB through `graph.query`. The node client supports query parameter maps using `graph.query(cypher, { params })`. Dynamic depth in the Blast Radius query is validated to an integer from 1 through 8 before it is interpolated; all other user-provided values are bound parameters.

With the installed FalkorDB TypeScript client, a query with result rows returns `{ metadata: string[], data: Record<string, unknown>[] }`. A query with no returned rows (such as a write without `RETURN`) returns `{ metadata: string[], data: undefined }`. The backend validates both forms and normalizes missing `data` to an empty array.
