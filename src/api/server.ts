import 'dotenv/config';
import { createReflexionHttpServer } from './reflexion-api.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const server = createReflexionHttpServer();

server.on('error', (err) => {
  console.error(err);
  process.exitCode = 1;
});

server.listen(port, () => {
  console.error(`reflexion-agent-ts API listening on http://localhost:${port}`);
  console.error(`POST /run with JSON body { "prompt": "...", "expected"?: { "fix"|"answer" } }`);
});
