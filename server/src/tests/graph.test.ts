import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { idSchema, maxDepthSchema } from '../graph/validation.js';

let available = false;
let close: (() => Promise<void>) | undefined;
let app: typeof import('../app.js').default;
let httpServer: Server | undefined;
let baseUrl = '';
let queries: typeof import('../graph/queries.js');

before(async () => {
  try {
    const client = await import('../graph/client.js');
    app = (await import('../app.js')).default;
    queries = await import('../graph/queries.js');
    close = client.closeGraphConnection;
    await queries.pingGraph();
    httpServer = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      httpServer?.once('listening', resolve);
      httpServer?.once('error', reject);
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine test server port');
    baseUrl = `http://127.0.0.1:${address.port}`;
    available = true;
  } catch { available = false; }
});

after(async () => {
  if (httpServer) await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
  if (close) await close();
});

test('FalkorDB connection and basic Cypher query', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  assert.ok((await queries.pingGraph()).data.length > 0);
});

test('Expert Finder query returns validated FalkorDB rows', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const result = await queries.findExpert('inc-2026-001');
  assert.ok(Array.isArray(result.data));
  const ava = result.data.find((row) => (row.engineer as { id?: string }).id === 'eng-ava');
  assert.ok(ava, 'expected the seeded API owner to remain an expert match');
  assert.ok('evidencePath' in ava, 'expert evidence path must remain in the result');
  assert.ok(Array.isArray(ava.priorIncidents));
  assert.ok(!(ava.priorIncidents as Array<{ id: string }>).some((incident) => incident.id === 'inc-2026-001'));
  const priorIncidents = ava.priorIncidents as Array<{ id: string; provenance?: string }>;
  assert.ok(priorIncidents.some((incident) => incident.id === 'inc-2025-042'));
  assert.equal(priorIncidents.find((incident) => incident.id === 'inc-2025-042')?.provenance, 'synthetic-demo');
});

test('incident context reports actual incident, affected-service paths, and direct decision links', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const context = await queries.getIncidentContext('inc-2026-001');
  assert.equal((context.incident as { id?: string; provenance?: string } | null)?.id, 'inc-2026-001');
  assert.equal((context.incident as { provenance?: string } | null)?.provenance, 'synthetic-demo');
  assert.ok(Array.isArray(context.services));
  assert.ok(Array.isArray(context.linkedDecisions));
  assert.equal(context.linkedDecisions.length, 1);
  assert.equal((context.linkedDecisions[0]?.decision as { id?: string }).id, 'dec-001');
  assert.ok(context.services.some((row) => (row.service as { id?: string }).id === 'svc-api'));
  assert.equal((context.services.find((row) => (row.service as { id?: string }).id === 'svc-api')?.service as { provenance?: string }).provenance, 'synthetic-demo');
  for (const row of context.services) {
    assert.ok('service' in row && 'evidencePath' in row);
    const path = row.evidencePath as { nodes: Array<{ labels: string[] }>; edges: Array<{ relationshipType: string; properties: Record<string, unknown> }> };
    assert.ok(path.edges.some((edge) => edge.relationshipType === 'AFFECTED'));
    assert.ok(path.nodes.some((node) => node.labels.includes('Incident')));
    assert.ok(path.nodes.some((node) => node.labels.includes('Service')));
  }
  for (const row of context.linkedDecisions) {
    assert.ok('decision' in row && 'evidencePath' in row);
    const path = row.evidencePath as { nodes: Array<{ labels: string[] }>; edges: Array<{ relationshipType: string; properties: Record<string, unknown> }> };
    assert.equal(path.edges.length, 1);
    assert.ok(path.nodes.some((node) => node.labels.includes('Incident')));
    assert.ok(path.nodes.some((node) => node.labels.includes('Decision')));
    const relevanceEdge = path.edges.find((edge) => edge.relationshipType === 'RELATED_TO');
    assert.ok(relevanceEdge);
    assert.equal((relevanceEdge.properties as { basis?: string }).basis, 'curated-relevance-only');
  }
});

test('incident context returns no linked decision when the incident is missing', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const context = await queries.getIncidentContext('inc-no-such-demo-record');
  assert.equal(context.incident, null);
  assert.deepEqual(context.linkedDecisions, []);
});

test('incident context endpoint returns FalkorDB evidence', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const response = await fetch(`${baseUrl}/api/incidents/inc-2026-001/context`);
  assert.equal(response.status, 200);
  const body = await response.json() as { incident: { id: string }; services: unknown[]; linkedDecisions: unknown[] };
  assert.equal(body.incident.id, 'inc-2026-001');
  assert.ok(Array.isArray(body.services));
  assert.ok(Array.isArray(body.linkedDecisions));
});

test('Decision Detective query returns validated FalkorDB rows', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const result = await queries.traceDecision('dec-001');
  assert.ok(Array.isArray(result.data));
  assert.ok(result.data.length > 0);
  const decisionRow = result.data.find((row) => (row.decision as { id?: string }).id === 'dec-001');
  assert.ok(decisionRow);
  assert.equal((decisionRow.decision as { provenance?: string }).provenance, 'synthetic-demo');
  assert.equal((decisionRow.source as { id?: string }).id, 'doc-001');
  assert.equal((decisionRow.source as { provenance?: string }).provenance, 'synthetic-internal-demo-artifact');
  assert.equal((decisionRow.source as { uri?: string }).uri, '');
  const path = decisionRow.evidencePath as { edges: Array<{ relationshipType: string }> };
  assert.ok(path.edges.some((edge) => edge.relationshipType === 'AUTHORED'));
  assert.ok(path.edges.some((edge) => edge.relationshipType === 'DOCUMENTED_IN'));
});

test('Blast Radius query returns validated FalkorDB rows', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const result = await queries.blastRadius('svc-api', 5);
  assert.ok(Array.isArray(result.data));
  if (result.data.length) assert.ok('evidencePath' in result.data[0]);
});

test('Blast Radius route defaults omitted depth to 5', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const response = await fetch(`${baseUrl}/api/blast-radius/svc-api`);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: unknown[] };
  assert.ok(Array.isArray(body.data));
});

test('Blast Radius route accepts a valid depth query string', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  const response = await fetch(`${baseUrl}/api/blast-radius/svc-api?depth=5`);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: unknown[] };
  assert.ok(Array.isArray(body.data));
});

test('Blast Radius route rejects invalid depths', async (t) => {
  if (!available) return t.skip('Requires a configured, reachable FalkorDB instance.');
  for (const depth of ['abc', '5.5', '0', '9']) {
    const response = await fetch(`${baseUrl}/api/blast-radius/svc-api?depth=${depth}`);
    assert.equal(response.status, 400, `expected depth=${depth} to be rejected`);
  }
});

test('query input validation rejects malformed identifiers', async () => {
  assert.throws(() => idSchema.parse('bad id; DELETE'));
  assert.throws(() => maxDepthSchema.parse(100));
});
