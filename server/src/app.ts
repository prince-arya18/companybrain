import express from 'express';
import { config } from './config.js';
import { blastRadius, findExpert, getIncidentContext, pingGraph, traceDecision } from './graph/queries.js';

const app = express();
app.use(express.json({ limit: '32kb' }));
app.get('/health', async (_req, res) => {
  try { await pingGraph(); res.json({ ok: true, graph: config.FALKORDB_GRAPH }); }
  catch { res.status(503).json({ ok: false, error: 'FalkorDB unavailable' }); }
});
app.get('/api/experts/:incidentId', async (req, res) => {
  try { res.json(await findExpert(req.params.incidentId)); }
  catch { res.status(400).json({ error: 'Invalid input or graph query failed' }); }
});
app.get('/api/incidents/:incidentId/context', async (req, res) => {
  try { res.json(await getIncidentContext(req.params.incidentId)); }
  catch { res.status(400).json({ error: 'Invalid input or graph query failed' }); }
});
app.get('/api/decisions/:decisionId', async (req, res) => {
  try { res.json(await traceDecision(req.params.decisionId)); }
  catch { res.status(400).json({ error: 'Invalid input or graph query failed' }); }
});
app.get('/api/blast-radius/:serviceId', async (req, res) => {
  try { res.json(await blastRadius(req.params.serviceId, req.query.depth ?? 5)); }
  catch { res.status(400).json({ error: 'Invalid input or graph query failed' }); }
});

export default app;
