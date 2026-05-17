import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createServer } from './http.js';

const config = loadConfig();
const db = createPool(config);
const server = createServer(config, db);

server.listen(config.port, () => {
  console.log(`AI Clash API listening on :${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`);
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
