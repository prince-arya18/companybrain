import { FalkorDB } from 'falkordb';
import { config } from '../config.js';

export const db = await FalkorDB.connect({
  url: config.FALKORDB_URL,
  ...(config.FALKORDB_TLS === 'true' ? { socket: { tls: true } } : {}),
});

const existingGraphs = await db.list();
if (!existingGraphs.includes(config.FALKORDB_GRAPH)) {
  await db.close();
  throw new Error(`Configured FalkorDB graph "${config.FALKORDB_GRAPH}" was not found; refusing to run queries that could create a graph.`);
}

export const graph = db.selectGraph(config.FALKORDB_GRAPH);

export async function closeGraphConnection(): Promise<void> {
  await db.close();
}
