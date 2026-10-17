import { graph } from './client.js';
import { idSchema, maxDepthSchema } from './validation.js';
import { z } from 'zod';

// FalkorDB 6.8.0 returns { metadata } for queries without rows, and
// { metadata, data: [{ columnName: value, ... }] } for queries with rows.
// The client types data as optional; normalize a missing data field to [].
const cypherResultSchema = z.object({
  metadata: z.array(z.string()),
  data: z.array(z.record(z.string(), z.unknown())).default([]),
}).passthrough();
type QueryParam = null | string | number | boolean | QueryParam[] | { [key: string]: QueryParam };

async function run(query: string, params: Record<string, QueryParam> = {}) {
  const result: unknown = await graph.query(query, { params });
  return cypherResultSchema.parse(result);
}

export async function pingGraph() {
  return run('RETURN 1 AS ok');
}

export async function ensureSchema() {
  return run('MERGE (meta:CompanyBrainSchema {id: $id}) SET meta.version = $version RETURN meta.version AS version', {
    id: 'company-brain-schema', version: '1',
  });
}

export async function seedDemoGraph() {
  const rows = [
    { id: 'team-platform', name: 'Platform Engineering' },
    { id: 'team-data', name: 'Data Engineering' },
  ];
  await run(`UNWIND $rows AS row MERGE (t:Team {id: row.id}) SET t.name = row.name, t.provenance = $provenance`, {
    rows, provenance: 'synthetic-demo',
  });
  await run(`MERGE (p:Project {id: $id}) SET p.name = $name, p.description = $description, p.provenance = $provenance`, {
    id: 'project-company-brain', name: 'Company Brain Demo',
    description: 'Synthetic engineering-incident scenario; all people, incidents, decisions, and documents are fictional.',
    provenance: 'synthetic-demo',
  });
  await run(`
    MERGE (e1:Engineer {id: $e1}) SET e1.name = $n1, e1.skills = $s1, e1.provenance = $provenance
    MERGE (e2:Engineer {id: $e2}) SET e2.name = $n2, e2.skills = $s2, e2.provenance = $provenance
    MERGE (s1:Service {id: $svc1}) SET s1.name = $sn1, s1.provenance = $provenance
    MERGE (s2:Service {id: $svc2}) SET s2.name = $sn2, s2.provenance = $provenance
    MERGE (i:Incident {id: $incident}) SET i.title = $title, i.severity = $severity, i.summary = $summary, i.provenance = $provenance
    MERGE (prior:Incident {id: $priorIncident}) SET prior.title = $priorTitle, prior.severity = $priorSeverity, prior.summary = $priorSummary, prior.provenance = $provenance
    MERGE (d:Decision {id: $decision}) SET d.title = $decisionTitle, d.summary = $decisionSummary, d.provenance = $provenance
    MERGE (doc:Document {id: $doc}) SET doc.title = $docTitle, doc.uri = $uri, doc.excerpt = $excerpt, doc.provenance = $documentProvenance
    MERGE (e1)-[:MEMBER_OF]->(:Team {id: $team1})
    MERGE (e2)-[:MEMBER_OF]->(:Team {id: $team2})
    MERGE (e1)-[:WORKS_ON]->(:Project {id: $project})
    MERGE (e2)-[:WORKS_ON]->(:Project {id: $project})
    MERGE (e1)-[:MAINTAINS]->(s1)
    MERGE (e2)-[:MAINTAINS]->(s2)
    MERGE (i)-[:AFFECTED]->(s1)
    MERGE (prior)-[:AFFECTED]->(s1)
    MERGE (i)-[relevance:RELATED_TO]->(d)
    SET relevance.basis = $relevanceBasis
    MERGE (e1)-[:RESOLVED {outcome: $outcome}]->(i)
    MERGE (e1)-[:RESOLVED {outcome: $priorOutcome}]->(prior)
    MERGE (s1)-[:DEPENDS_ON {criticality: $criticality}]->(s2)
    MERGE (e2)-[:AUTHORED]->(d)
    MERGE (d)-[:DOCUMENTED_IN {excerpt: $excerpt}]->(doc)
  `, {
    e1: 'eng-ava', n1: 'Ava Patel', s1: ['incident response', 'platform', 'kubernetes'],
    e2: 'eng-noah', n2: 'Noah Kim', s2: ['data pipelines', 'warehouse'],
    svc1: 'svc-api', sn1: 'API Gateway', svc2: 'svc-data', sn2: 'Data Pipeline',
    incident: 'inc-2026-001', title: 'API latency spike', severity: 'SEV-2',
    summary: 'Synthetic scenario: API latency rose during an analytics export workload that added synchronous work to API request paths.',
    priorIncident: 'inc-2025-042', priorTitle: 'API latency during analytics export', priorSeverity: 'SEV-3',
    priorSummary: 'Synthetic prior incident: an export workload increased API request latency; Ava Patel resolved the incident.',
    decision: 'dec-001', decisionTitle: 'Use async events for analytics',
    decisionSummary: 'Synthetic architectural context: decouple analytics writes from API requests. This decision is linked as relevant context only.',
    doc: 'doc-001', docTitle: 'Synthetic internal demo artifact: ADR-001 - Async analytics',
    uri: '', excerpt: 'Synthetic demo excerpt: analytics events are published asynchronously to reduce work on API request paths.',
    provenance: 'synthetic-demo', documentProvenance: 'synthetic-internal-demo-artifact',
    team1: 'team-platform', team2: 'team-data', project: 'project-company-brain',
    outcome: 'resolved', priorOutcome: 'resolved', criticality: 'high',
    relevanceBasis: 'curated-relevance-only',
  });
  return { seeded: true, teams: rows.length, sampleIncidentId: 'inc-2026-001', sampleServiceId: 'svc-api' };
}

export async function findExpert(incidentIdInput: unknown) {
  const incidentId = idSchema.parse(incidentIdInput);
  return run(`
    MATCH path = (i:Incident {id: $incidentId})-[:AFFECTED]->(s:Service)<-[:MAINTAINS]-(e:Engineer)
    OPTIONAL MATCH (e)-[r:RESOLVED]->(prior:Incident)
    WHERE prior.id <> i.id AND r.outcome = 'resolved'
    RETURN e { .id, .name, .skills, .provenance } AS engineer, s { .id, .name, .provenance } AS service,
           collect(DISTINCT prior { .id, .title, .provenance }) AS priorIncidents,
           count(DISTINCT prior) AS priorIncidentCount, path AS evidencePath
    ORDER BY priorIncidentCount DESC LIMIT 5
  `, { incidentId });
}

export async function getIncidentContext(incidentIdInput: unknown) {
  const incidentId = idSchema.parse(incidentIdInput);
  const [incidentResult, serviceResult, decisionResult] = await Promise.all([
    run(`MATCH (i:Incident {id: $incidentId}) RETURN i { .id, .title, .severity, .summary, .provenance } AS incident`, { incidentId }),
    run(`
      MATCH path = (i:Incident {id: $incidentId})-[:AFFECTED]->(s:Service)
      RETURN s { .id, .name, .provenance } AS service, path AS evidencePath
    `, { incidentId }),
    run(`
      MATCH path = (i:Incident {id: $incidentId})-[r]-(d:Decision)
      RETURN d { .id, .title, .provenance } AS decision, path AS evidencePath
    `, { incidentId }),
  ]);

  return {
    incident: (incidentResult.data[0]?.incident as Record<string, unknown> | undefined) ?? null,
    services: serviceResult.data,
    linkedDecisions: decisionResult.data,
  };
}

export async function traceDecision(decisionIdInput: unknown) {
  const decisionId = idSchema.parse(decisionIdInput);
  return run(`
    MATCH path = (e:Engineer)-[:AUTHORED]->(d:Decision {id: $decisionId})-[:DOCUMENTED_IN]->(doc:Document)
    RETURN e { .id, .name, .provenance } AS author, d { .id, .title, .summary, .provenance } AS decision,
           doc { .id, .title, .uri, .excerpt, .provenance } AS source, path AS evidencePath
  `, { decisionId });
}

export async function blastRadius(serviceIdInput: unknown, maxDepthInput: unknown = 5) {
  const serviceId = idSchema.parse(serviceIdInput);
  const maxDepth = maxDepthSchema.parse(maxDepthInput);
  return run(`
    MATCH path = (root:Service {id: $serviceId})-[:DEPENDS_ON*1..${maxDepth}]->(affected:Service)
    RETURN affected { .id, .name } AS service, path AS evidencePath
    LIMIT 100
  `, { serviceId });
}

