import { config } from './config.js';
import { closeGraphConnection } from './graph/client.js';
import app from './app.js';

const server = app.listen(config.PORT, () => console.log(`Company Brain API listening on ${config.PORT}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(() => { void closeGraphConnection().finally(() => process.exit(0)); });
});
