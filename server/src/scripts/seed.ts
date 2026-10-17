import { closeGraphConnection } from '../graph/client.js';
import { ensureSchema, seedDemoGraph } from '../graph/queries.js';

try {
  await ensureSchema();
  console.log(JSON.stringify(await seedDemoGraph(), null, 2));
} finally {
  await closeGraphConnection();
}
