import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type Feature = 'investigation' | 'expert' | 'decision' | 'blast';
type ApiEnvelope<T> = { metadata?: string[]; data: T[] };
type EvidenceNode = { id: number; labels: string[]; properties: Record<string, unknown> };
type EvidenceEdge = { id: number; sourceId: number; destinationId: number; properties: Record<string, unknown>; relationshipType: string };
type EvidencePath = { nodes: EvidenceNode[]; edges: EvidenceEdge[] };
type ExpertRow = {
  engineer: { id: string; name: string; skills: string[]; provenance?: string };
  service: { id: string; name: string; provenance?: string };
  priorIncidents: Array<{ id: string; title: string; provenance?: string }>;
  priorIncidentCount: number;
  evidencePath: EvidencePath;
};
type DecisionRow = {
  author: { id: string; name: string; provenance?: string };
  decision: { id: string; title: string; summary: string; provenance?: string };
  source: { id: string; title: string; uri: string; excerpt: string; provenance?: string };
  evidencePath: EvidencePath;
};
type BlastRow = { service: { id: string; name: string }; evidencePath: EvidencePath };
type IncidentSummary = { id: string; title: string; severity: string; summary: string; provenance?: string };
type IncidentContext = {
  incident: IncidentSummary | null;
  services: Array<{ service: { id: string; name: string; provenance?: string }; evidencePath: EvidencePath }>;
  linkedDecisions: Array<{ decision: { id: string; title: string; provenance?: string }; evidencePath: EvidencePath }>;
};
type InvestigationReport = {
  context: IncidentContext;
  experts: ExpertRow[];
  decisions: DecisionRow[];
  blast: BlastRow[];
  linkedDecisionIds: string[];
  serviceIds: string[];
};

const featureCopy: Record<Feature, { title: string; eyebrow: string; description: string; label: string; placeholder: string; initial: string; icon: string; accent: string }> = {
  investigation: {
    title: 'Incident Investigation', eyebrow: 'End-to-end workflow',
    description: 'Combine responder, decision, and dependency evidence for one incident.',
    label: 'Incident ID', placeholder: 'e.g. inc-2026-001', initial: 'inc-2026-001', icon: '◉', accent: 'blue',
  },
  expert: {
    title: 'Expert Finder', eyebrow: 'Incident response',
    description: 'Find engineers with relevant ownership and incident history.',
    label: 'Incident ID', placeholder: 'e.g. inc-2026-001', initial: 'inc-2026-001', icon: '◎', accent: 'blue',
  },
  decision: {
    title: 'Decision Detective', eyebrow: 'Architecture context',
    description: 'Trace a decision to its author and the document that records it.',
    label: 'Decision ID', placeholder: 'e.g. dec-001', initial: 'dec-001', icon: '⌕', accent: 'violet',
  },
  blast: {
    title: 'Blast Radius', eyebrow: 'Dependency analysis',
    description: 'Follow service dependencies to see what could be affected.',
    label: 'Service ID', placeholder: 'e.g. svc-api', initial: 'svc-api', icon: '⌁', accent: 'amber',
  },
};

const navItems: Array<{ id: Feature; icon: string }> = [
  { id: 'investigation', icon: '◉' },
  { id: 'expert', icon: '◎' },
  { id: 'decision', icon: '⌕' },
  { id: 'blast', icon: '⌁' },
];

function displayValue(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function entityName(node: EvidenceNode): string {
  return displayValue(node.properties.name ?? node.properties.title ?? node.properties.id, 'Unknown entity');
}

function FitGraphView({ layoutKey }: { layoutKey: string }) {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  useEffect(() => {
    if (!nodesInitialized) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.28, minZoom: 0.1, maxZoom: 1.2 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, layoutKey, nodesInitialized]);

  return null;
}

function GraphPath({ path }: { path?: EvidencePath }) {
  const nodes = path?.nodes ?? [];
  const edges = path?.edges ?? [];
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodePositions = useMemo(() => {
    const positions = new Map<number, number>();
    nodes.forEach((node, index) => {
      if (index === 0) {
        positions.set(node.id, 0);
        return;
      }
      const previousNode = nodes[index - 1];
      const relationship = edges.find((edge) =>
        (edge.sourceId === previousNode.id && edge.destinationId === node.id)
        || (edge.destinationId === previousNode.id && edge.sourceId === node.id));
      const labelGap = relationship ? Math.max(94, relationship.relationshipType.length * 6.2 + 20) : 94;
      positions.set(node.id, (positions.get(previousNode.id) ?? 0) + 194 + labelGap);
    });
    return positions;
  }, [edges, nodes]);
  const flowNodes = useMemo<Node[]>(() => nodes.map((node, index) => ({
    id: String(node.id),
    position: { x: nodePositions.get(node.id) ?? index * 288, y: index % 2 ? 18 : 0 },
    data: { label: <div className="flow-node-content"><span className="flow-node-kind">{node.labels[0] ?? 'Node'}</span><strong>{entityName(node)}</strong><small>{displayValue(node.properties.id)}</small></div> },
    selected: String(node.id) === selectedNodeId,
    style: { width: 194, minHeight: 90, background: '#111c2d', color: '#e5edf8', border: '1px solid #26364b', borderRadius: 13, padding: 0 },
  })), [nodes, nodePositions, selectedNodeId]);
  const flowEdges = useMemo<Edge[]>(() => edges.map((edge) => ({
    id: String(edge.id),
    source: String(edge.sourceId),
    target: String(edge.destinationId),
    label: edge.relationshipType,
    type: 'smoothstep',
    animated: false,
    labelStyle: { fill: '#b4c4d8', fontSize: 9, fontWeight: 750 },
    labelBgStyle: { fill: '#0b1220', fillOpacity: 1, stroke: '#26364b', strokeWidth: 1 },
    style: { stroke: '#4d7cfe', strokeWidth: 1.6 },
  })), [edges]);
  const selectedNode = nodes.find((node) => String(node.id) === selectedNodeId);
  const selectedRelationships = selectedNode
    ? edges.flatMap((edge) => {
      if (edge.sourceId !== selectedNode.id && edge.destinationId !== selectedNode.id) return [];
      const otherNode = nodes.find((node) => node.id === (edge.sourceId === selectedNode.id ? edge.destinationId : edge.sourceId));
      if (!otherNode) return [];
      return [{ edge, otherNode, outgoing: edge.sourceId === selectedNode.id }];
    })
    : [];

  if (!nodes.length) return <div className="graph-empty">No graph path was returned for this result.</div>;
  return (
    <div className="graph-visualization">
      <div className="graph-canvas" aria-label="Evidence graph path">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          fitViewOptions={{ padding: 0.28, minZoom: 0.1, maxZoom: 1.2 }}
          minZoom={0.1}
          maxZoom={1.5}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        >
          <Background color="#26364b" gap={22} size={1} />
          <Controls showInteractive={false} />
          <FitGraphView layoutKey={`${flowNodes.map((node) => `${node.id}:${node.position.x}:${node.position.y}`).join(',')}|${flowEdges.map((edge) => `${edge.id}:${edge.label}`).join(',')}`} />
        </ReactFlow>
      </div>
      {selectedNode && (
        <div className="node-inspector" aria-live="polite">
          <div className="node-inspector-heading">
            <span>{selectedNode.labels.join(' · ') || 'Node'}</span>
            <button type="button" onClick={() => setSelectedNodeId(null)} aria-label="Close node details">×</button>
          </div>
          <strong>{entityName(selectedNode)}</strong>
          <code>{displayValue(selectedNode.properties.id, `Graph node ${selectedNode.id}`)}</code>
          <div className="node-inspector-links">
            {selectedRelationships.length ? selectedRelationships.map(({ edge, otherNode, outgoing }) => (
              <span key={edge.id}>{outgoing ? `${edge.relationshipType} → ${entityName(otherNode)}` : `${entityName(otherNode)} → ${edge.relationshipType}`}</span>
            )) : <span>No connected relationships in this path.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, detail, trailing }: { icon: string; title: string; detail?: string; trailing?: ReactNode }) {
  return (
    <div className="section-title-row">
      <div className="section-title-icon">{icon}</div>
      <div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>
      {trailing && <div className="section-trailing">{trailing}</div>}
    </div>
  );
}

function EvidenceCard({ path, index }: { path: EvidencePath; index: number }) {
  const syntheticDemo = path.nodes.some((node) => node.properties.provenance === 'synthetic-demo');
  return (
    <section className="panel evidence-panel">
      <SectionTitle icon="⤳" title={`Evidence path ${String(index + 1).padStart(2, '0')}`} detail={`${path.nodes.length} graph nodes · ${path.edges.length} relationships`} />
      {syntheticDemo && <p className="provenance-note">Synthetic demo graph evidence; these records do not represent production incidents.</p>}
      <GraphPath path={path} />
      {path.edges.length > 0 && (
        <div className="relationship-list">
          {path.edges.map((edge) => {
            const from = path.nodes.find((node) => node.id === edge.sourceId);
            const to = path.nodes.find((node) => node.id === edge.destinationId);
            return <div className="relationship-item" key={edge.id}><span>{from ? entityName(from) : 'Node'}</span><b>{edge.relationshipType}</b><span>{to ? entityName(to) : 'Node'}</span></div>;
          })}
        </div>
      )}
    </section>
  );
}

function ExpertResults({ rows }: { rows: ExpertRow[] }) {
  return <div className="results-stack">{rows.map((row, index) => (
    <div className="result-grid" key={`${row.engineer.id}-${index}`}>
      <section className="panel result-panel">
        <SectionTitle icon="♙" title="Recommended engineer" detail="Matched from service ownership and incident history" trailing={<span className="match-pill">Graph match</span>} />
        <div className="person-row"><div className="avatar avatar-blue">{row.engineer.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><h3>{row.engineer.name}</h3><p>{row.engineer.id}</p></div></div>
        <div className="detail-block"><span className="detail-label">Relevant skills</span><div className="tag-row">{row.engineer.skills?.length ? row.engineer.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>) : <span className="muted">No skills recorded</span>}</div></div>
        <div className="detail-block"><span className="detail-label">Maintains</span><div className="service-chip"><span className="service-dot" />{row.service.name}<code>{row.service.id}</code></div></div>
        <div className="detail-block"><span className="detail-label">Prior resolved incidents</span>{row.priorIncidents?.length ? <div className="incident-list">{row.priorIncidents.map((incident) => <div className="incident-line" key={incident.id}><span className="incident-mark">✓</span><span>{incident.title}</span><code>{incident.id}</code></div>)}</div> : <span className="muted">No other resolved incidents found.</span>}</div>
      </section>
      <EvidenceCard path={row.evidencePath} index={index} />
    </div>
  ))}</div>;
}

function DecisionResults({ rows }: { rows: DecisionRow[] }) {
  return <div className="results-stack">{rows.map((row, index) => (
    <div className="result-grid" key={`${row.decision.id}-${index}`}>
      <section className="panel result-panel">
        <SectionTitle icon="⌕" title="Decision record" detail="Author and source resolved from the graph" />
        <div className="decision-heading"><span className="decision-badge">ADR</span><div><h3>{row.decision.title}</h3><p>{row.decision.id}</p></div></div>
        <p className="decision-summary">{row.decision.summary}</p>
        <div className="detail-block"><span className="detail-label">Authored by</span><div className="person-inline"><span className="avatar avatar-violet">{row.author.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{row.author.name}</strong><small>{row.author.id}</small></div></div></div>
        <div className="source-card"><div className="source-icon">▤</div><div className="source-main"><span className="detail-label">Source document</span><strong>{row.source.title}</strong><p>{row.source.excerpt}</p>{/^https?:\/\//i.test(row.source.uri) ? <a href={row.source.uri} target="_blank" rel="noreferrer">Open source</a> : <span className="source-provenance">{row.source.provenance === 'synthetic-internal-demo-artifact' ? 'Synthetic internal demo artifact; no external URL supplied.' : 'No external HTTP(S) source URL available.'}</span>}</div></div>
      </section>
      <EvidenceCard path={row.evidencePath} index={index} />
    </div>
  ))}</div>;
}

function BlastResults({ rows }: { rows: BlastRow[] }) {
  return <div className="results-stack">{rows.map((row, index) => (
    <div className="result-grid" key={`${row.service.id}-${index}`}>
      <section className="panel result-panel">
        <SectionTitle icon="⌁" title="Potentially affected service" detail="Reached by dependency traversal" trailing={<span className="impact-pill">Dependency</span>} />
        <div className="affected-service"><span className="service-symbol">⌘</span><div><h3>{row.service.name}</h3><p>{row.service.id}</p></div></div>
        <div className="impact-note"><span>↳</span><p>This service is reachable from the selected root through the returned dependency path.</p></div>
        <div className="detail-block"><span className="detail-label">Path length</span><strong>{Math.max(0, row.evidencePath.edges.length)} relationship{row.evidencePath.edges.length === 1 ? '' : 's'}</strong></div>
      </section>
      <EvidenceCard path={row.evidencePath} index={index} />
    </div>
  ))}</div>;
}

async function requestJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint);
  const body = await response.json() as T | { error?: string };
  if (!response.ok) {
    const errorBody = body as { error?: unknown } | null;
    const message = errorBody && typeof errorBody === 'object' && typeof errorBody.error === 'string'
      ? errorBody.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

async function requestRows<T>(endpoint: string): Promise<T[]> {
  const body = await requestJson<ApiEnvelope<T>>(endpoint);
  if (!Array.isArray(body.data)) throw new Error('The API returned an unexpected response shape.');
  return body.data;
}

function IncidentInvestigation() {
  const [incidentId, setIncidentId] = useState(featureCopy.investigation.initial);
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [copied, setCopied] = useState(false);

  async function runInvestigation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = incidentId.trim();
    setError('');
    setValidationError('');
    setCopied(false);
    if (!id || id.length > 100 || !/^[A-Za-z0-9_.:-]+$/.test(id)) {
      setValidationError('Enter an incident ID using letters, numbers, dots, underscores, colons, or hyphens (up to 100 characters).');
      return;
    }

    setLoading(true);
    setReport(null);
    try {
      const encodedId = encodeURIComponent(id);
      const [context, experts] = await Promise.all([
        requestJson<IncidentContext>(`/api/incidents/${encodedId}/context`),
        requestRows<ExpertRow>(`/api/experts/${encodedId}`),
      ]);
      const serviceIds = [...new Set([
        ...context.services.map(({ service }) => service.id),
        ...experts.map(({ service }) => service.id),
      ])];
      const linkedDecisionIds = [...new Set(context.linkedDecisions.map(({ decision }) => decision.id))];
      const [decisionGroups, blastGroups] = await Promise.all([
        Promise.all(linkedDecisionIds.map((decisionId) => requestRows<DecisionRow>(`/api/decisions/${encodeURIComponent(decisionId)}`))),
        Promise.all(serviceIds.map((serviceId) => requestRows<BlastRow>(`/api/blast-radius/${encodeURIComponent(serviceId)}?depth=5`))),
      ]);
      setReport({ context, experts, decisions: decisionGroups.flat(), blast: blastGroups.flat(), linkedDecisionIds, serviceIds });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to complete the incident investigation.');
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    if (!report) return;
    const incident = report.context.incident;
    const paths = [
      ...report.experts.map(({ evidencePath }) => evidencePath),
      ...report.context.linkedDecisions.map(({ evidencePath }) => evidencePath),
      ...report.blast.map(({ evidencePath }) => evidencePath),
    ];
    const lines = [
      `Company Brain incident investigation: ${incident?.id ?? incidentId.trim()}`,
      incident ? `${incident.title} (${incident.severity}): ${incident.summary}` : 'Incident record: not found in graph.',
      `Recommended engineers: ${report.experts.map(({ engineer }) => `${engineer.name} (${engineer.id})`).join(', ') || 'none returned'}`,
      `Directly linked decision IDs: ${report.linkedDecisionIds.join(', ') || 'none; no direct Incident-to-Decision relationship found'}`,
      `Decision details: ${report.decisions.map(({ decision, author, source }) => `${decision.title} (${decision.id}), authored by ${author.name}, source ${source.title}${source.uri ? ` (${source.uri})` : ' (synthetic internal demo artifact; no external URL)'}`).join('; ') || (report.linkedDecisionIds.length ? 'Decision Detective returned no authored-and-documented record' : 'unavailable because no direct link was found')}`,
      `Affected downstream services: ${report.blast.map(({ service }) => `${service.name} (${service.id})`).join(', ') || 'none returned'}`,
      `Evidence paths returned: ${paths.length}`,
      ...paths.map((path, index) => `Path ${index + 1}: ${path.nodes.map(entityName).join(' → ')}${path.edges.length ? ` [${path.edges.map((edge) => edge.relationshipType).join(', ')}]` : ''}`),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  }

  return (
    <section className="results-section investigation-workflow">
      <div className="results-header"><div><span className="results-eyebrow">END-TO-END INVESTIGATION</span><h2>Incident evidence report</h2></div><span className="evidence-label"><span>✳</span> Live FalkorDB evidence</span></div>
      <form className="panel investigation-input" onSubmit={runInvestigation}>
        <label className="input-label" htmlFor="investigation-incident-id">Incident ID</label>
        <div className="form-controls">
          <input id="investigation-incident-id" value={incidentId} onChange={(event) => setIncidentId(event.target.value)} placeholder="e.g. inc-2026-001" aria-invalid={Boolean(validationError)} />
          <button className="submit-button" type="submit" disabled={loading}><span>{loading ? <span className="spinner" /> : '◉'}</span>{loading ? 'Running investigation' : 'Run investigation'}{!loading && <b>→</b>}</button>
        </div>
        {validationError && <p className="form-message validation-message" role="alert">{validationError}</p>}
        {error && <p className="form-message error-message" role="alert"><span>!</span>{error}</p>}
        <p className="form-hint">Queries incident context and expert evidence, then follows only returned service and decision IDs.</p>
      </form>

      {!report && !loading && <div className="empty-state panel"><div className="empty-orbit"><span>◉</span><i /><b /></div><h3>Ready to investigate</h3><p>Run the workflow to collect the incident, responder, decision, dependency, and graph-path evidence available for this incident.</p></div>}

      {report && (
        <>
          <section className="panel report-summary">
            <div><span className="results-eyebrow">COMBINED REPORT</span><h3>{report.context.incident?.title ?? 'Incident record not found'}</h3>
              {report.context.incident ? <p><code>{report.context.incident.id}</code> · {report.context.incident.severity} · {report.context.incident.summary}</p> : <p>No Incident node was returned for <code>{incidentId.trim()}</code>; related evidence is unavailable.</p>}
            </div>
            <button type="button" className="copy-report-button" onClick={copyReport}>{copied ? 'Copied' : 'Copy report'}</button>
          </section>

          <section className="workflow-stage panel">
            <SectionTitle icon="01" title="Expert discovery" detail="Existing Expert Finder results for this incident" />
            {report.experts.length ? <ExpertResults rows={report.experts} /> : <p className="workflow-notice">No expert match was returned for this incident.</p>}
          </section>

          <section className="workflow-stage panel">
            <SectionTitle icon="02" title="Architecture decision" detail="Only direct Incident-to-Decision graph links are followed" />
            {report.context.linkedDecisions.some(({ evidencePath }) => evidencePath.edges.some((edge) => edge.relationshipType === 'RELATED_TO' && edge.properties.basis === 'curated-relevance-only')) && <p className="provenance-note">The RELATED_TO edge records curated scenario relevance only; it does not claim that the decision caused or resolved this incident.</p>}
            {report.linkedDecisionIds.length === 0
              ? <p className="workflow-notice">No linked decision found. This graph has no direct relationship from this Incident node to a Decision node. Add the appropriate incident-to-decision relationship in FalkorDB to make a decision traceable here.</p>
              : report.decisions.length
                ? <DecisionResults rows={report.decisions} />
                : <p className="workflow-notice">A direct decision link exists, but Decision Detective returned no authored-and-documented decision record for it.</p>}
          </section>

          <section className="workflow-stage panel">
            <SectionTitle icon="03" title="Dependency impact" detail="Blast Radius queried for service IDs returned by incident and expert graph paths" />
            {report.context.services.length > 0 && <div className="root-service-list"><span className="detail-label">Incident affected services</span>{report.context.services.map(({ service }) => <div className="service-chip" key={service.id}><span className="service-dot" />{service.name}<code>{service.id}</code></div>)}</div>}
            {!report.serviceIds.length
              ? <p className="workflow-notice">No affected service was returned. The incident needs an `AFFECTED` relationship to a Service node before dependency traversal is possible.</p>
              : report.blast.length
                ? <BlastResults rows={report.blast} />
                : <p className="workflow-notice">The incident is linked to {report.serviceIds.map((id) => <code key={id}>{id}</code>)}; Blast Radius returned no downstream services at depth 5.</p>}
          </section>

          <section className="panel report-evidence">
            <SectionTitle icon="04" title="Evidence availability" detail="Relationship paths and provenance returned from the graph" />
            <div className="evidence-status-list">
              <span>{report.context.incident ? 'Incident record confirmed' : 'Incident record unavailable'}</span>
              <span>{report.experts.length ? `${report.experts.length} expert evidence path(s)` : 'No expert evidence paths returned'}</span>
              <span>{report.context.linkedDecisions.length ? `${report.context.linkedDecisions.length} direct decision link path(s)` : 'No direct decision link found'}</span>
              <span>{report.blast.length ? `${report.blast.length} downstream service path(s)` : 'No downstream paths returned'}</span>
            </div>
            {report.context.services.map(({ service, evidencePath }, index) => <EvidenceCard key={`incident-service-${service.id}`} path={evidencePath} index={index} />)}
            {report.context.linkedDecisions.map(({ decision, evidencePath }, index) => <EvidenceCard key={`incident-decision-${decision.id}`} path={evidencePath} index={index + report.context.services.length} />)}
          </section>
        </>
      )}
    </section>
  );
}

function App() {
  const [activeFeature, setActiveFeature] = useState<Feature>('expert');
  const [ids, setIds] = useState<Record<Feature, string>>({ investigation: featureCopy.investigation.initial, expert: featureCopy.expert.initial, decision: featureCopy.decision.initial, blast: featureCopy.blast.initial });
  const [depth, setDepth] = useState(5);
  const [expertRows, setExpertRows] = useState<ExpertRow[] | null>(null);
  const [decisionRows, setDecisionRows] = useState<DecisionRow[] | null>(null);
  const [blastRows, setBlastRows] = useState<BlastRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [connection, setConnection] = useState<'checking' | 'connected' | 'offline'>('checking');

  useEffect(() => {
    let active = true;
    fetch('/health').then((response) => {
      if (!response.ok) throw new Error('offline');
      return response.json();
    }).then((status: { ok?: boolean }) => { if (active) setConnection(status.ok ? 'connected' : 'offline'); })
      .catch(() => { if (active) setConnection('offline'); });
    return () => { active = false; };
  }, []);

  const current = featureCopy[activeFeature];
  const currentRows = activeFeature === 'investigation' ? null : activeFeature === 'expert' ? expertRows : activeFeature === 'decision' ? decisionRows : blastRows;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setValidationError('');
    const id = ids[activeFeature].trim();
    if (!id || id.length > 100 || !/^[A-Za-z0-9_.:-]+$/.test(id)) {
      setValidationError('Enter an ID using letters, numbers, dots, underscores, colons, or hyphens (up to 100 characters).');
      return;
    }
    if (activeFeature === 'expert') setExpertRows(null);
    if (activeFeature === 'decision') setDecisionRows(null);
    if (activeFeature === 'blast') setBlastRows(null);
    setLoading(true);
    try {
      const endpoint = activeFeature === 'expert'
        ? `/api/experts/${encodeURIComponent(id)}`
        : activeFeature === 'decision'
          ? `/api/decisions/${encodeURIComponent(id)}`
          : `/api/blast-radius/${encodeURIComponent(id)}?depth=${depth}`;
      const response = await fetch(endpoint);
      const body = await response.json() as ApiEnvelope<ExpertRow | DecisionRow | BlastRow> | { error?: string };
      if (!response.ok) throw new Error('error' in body && body.error ? body.error : `Request failed (${response.status})`);
      if (!('data' in body) || !Array.isArray(body.data)) throw new Error('The API returned an unexpected response shape.');
      if (activeFeature === 'expert') setExpertRows(body.data as ExpertRow[]);
      if (activeFeature === 'decision') setDecisionRows(body.data as DecisionRow[]);
      if (activeFeature === 'blast') setBlastRows(body.data as BlastRow[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reach the Company Brain API.');
    } finally {
      setLoading(false);
    }
  }

  function changeFeature(feature: Feature) {
    setActiveFeature(feature);
    setError('');
    setValidationError('');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><div><strong>company<span>brain</span></strong><small>ENGINEERING INTELLIGENCE</small></div></div>
        <div className="workspace-switch"><div className="workspace-avatar">F</div><div><span className="workspace-label">WORKSPACE</span><strong>FalkorDB Track 03</strong></div><span className="chevron">⌄</span></div>
        <div className="nav-caption">INVESTIGATE</div>
        <nav className="main-nav" aria-label="Investigation tools">
          {navItems.map(({ id, icon }) => <button key={id} className={`nav-item ${activeFeature === id ? 'active' : ''}`} onClick={() => changeFeature(id)}><span className={`nav-icon ${featureCopy[id].accent}`}>{icon}</span><span>{featureCopy[id].title}</span>{activeFeature === id && <span className="nav-active-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className={`status-dot ${connection}`} /><div><strong>{connection === 'checking' ? 'Checking graph' : connection === 'connected' ? 'Graph connected' : 'Graph unavailable'}</strong><small>FalkorDB · mygraph</small></div></div>
          <div className="user-profile"><div className="user-avatar">CB</div><div><strong>Company Brain</strong><small>Engineering workspace</small></div><button aria-label="Workspace options">···</button></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>Investigation</strong></div><div className="topbar-actions"><span className="live-indicator"><i /> Live graph</span><button className="help-button" aria-label="Help">?</button></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><div className="overline"><span className="overline-line" /> GRAPH-POWERED INCIDENT INTELLIGENCE</div><h1>Good morning. <span>Let’s find the signal.</span></h1><p>Investigate incidents with the context already connected across your engineering graph.</p></div><div className="welcome-meta"><span className="meta-label">ACTIVE GRAPH</span><strong><span className="green-dot" /> mygraph</strong><small>FalkorDB instance</small></div></section>

          <section className="feature-tabs" aria-label="Select an investigation">
            {navItems.map(({ id, icon }, index) => <button key={id} onClick={() => changeFeature(id)} className={`feature-tab ${activeFeature === id ? 'selected' : ''}`}><span className={`feature-tab-icon ${featureCopy[id].accent}`}>{icon}</span><span className="feature-tab-copy"><small>0{index + 1} · {featureCopy[id].eyebrow}</small><strong>{featureCopy[id].title}</strong></span>{activeFeature === id && <span className="tab-chevron">→</span>}</button>)}
          </section>

          {activeFeature === 'investigation' ? <IncidentInvestigation /> : <>
          <section className={`search-panel search-${current.accent}`}>
            <div className="search-heading"><div className={`feature-glyph ${current.accent}`}>{current.icon}</div><div><span className="search-eyebrow">{current.eyebrow}</span><h2>{current.title}</h2><p>{current.description}</p></div><div className="query-badge"><span className="query-pulse" /> GRAPH QUERY</div></div>
            <form className="query-form" onSubmit={submit}>
              <label className="input-label" htmlFor="entity-id">{current.label}</label>
              <div className="form-controls">
                <input id="entity-id" list="known-ids" autoComplete="off" value={ids[activeFeature]} onChange={(event) => setIds((previous) => ({ ...previous, [activeFeature]: event.target.value }))} placeholder={current.placeholder} aria-invalid={Boolean(validationError)} />
                <datalist id="known-ids">
                  <option value="inc-2026-001" />
                  <option value="dec-001" />
                  <option value="svc-api" />
                </datalist>
                {activeFeature === 'blast' && <label className="depth-control"><span>Depth</span><select value={depth} onChange={(event) => setDepth(Number(event.target.value))}>{Array.from({ length: 8 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} {value === 1 ? 'hop' : 'hops'}</option>)}</select><span className="select-chevron">⌄</span></label>}
                <button className="submit-button" type="submit" disabled={loading}><span>{loading ? <span className="spinner" /> : '⌕'}</span>{loading ? 'Investigating' : 'Investigate'}{!loading && <b>→</b>}</button>
              </div>
              {validationError && <p className="form-message validation-message" role="alert">{validationError}</p>}
              {error && <p className="form-message error-message" role="alert"><span>!</span>{error}</p>}
              <div className="form-hint"><span>↳</span> Data and evidence are retrieved live from your FalkorDB graph.</div>
            </form>
          </section>

          <section className="results-section">
            <div className="results-header"><div><span className="results-eyebrow">INVESTIGATION OUTPUT</span><h2>{activeFeature === 'expert' ? 'Recommended experts' : activeFeature === 'decision' ? 'Decision trail' : 'Affected services'} <span className="results-count">{currentRows?.length ?? '—'}</span></h2></div><span className="evidence-label"><span>✳</span> Evidence-backed results</span></div>
            {currentRows === null ? <div className="empty-state panel"><div className="empty-orbit"><span>{current.icon}</span><i /><b /></div><h3>Ready when you are</h3><p>Enter an ID above to query your graph. Each result includes the path and source evidence behind it.</p><div className="empty-steps"><span><b>01</b> Choose an investigation</span><span><b>02</b> Enter an entity ID</span><span><b>03</b> Review graph evidence</span></div></div>
              : currentRows.length === 0 ? <div className="no-results panel"><div className="no-results-icon">⌕</div><h3>No matching records found</h3><p>The API returned no results for <code>{ids[activeFeature]}</code>. Check the ID or try another entity in this graph.</p></div>
                : activeFeature === 'expert' ? <ExpertResults rows={expertRows ?? []} />
                  : activeFeature === 'decision' ? <DecisionResults rows={decisionRows ?? []} />
                    : <BlastResults rows={blastRows ?? []} />}
          </section>
          </>}

          <footer className="page-footer"><span>COMPANY BRAIN <b>·</b> ENGINEERING CONTEXT, CONNECTED</span><span>Powered by FalkorDB <i>◈</i></span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
