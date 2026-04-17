import { createServer } from 'node:http';
import { ReflexionAgent } from '../reflexion/ReflexionAgent.js';
import { createFlexibleEvaluator } from '../reflexion/evaluator.js';

function clampMaxAttempts(n: unknown): number {
  const d = typeof n === 'number' ? n : typeof n === 'string' ? Number.parseInt(n, 10) : Number.NaN;
  if (!Number.isFinite(d) || d < 1) return 3;
  return Math.min(50, Math.floor(d));
}

/** Path without query string (e.g. `/run?x=1` → `/run`). */
function requestPath(raw: string): string {
  const i = raw.indexOf('?');
  return i === -1 ? raw : raw.slice(0, i);
}

/**
 * HTTP server for `GET /health` and `POST /run` (JSON body).
 */
export function createReflexionHttpServer() {
  return createServer(async (req, res) => {
    const path = requestPath(req.url ?? '');

    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (req.method === 'POST' && path === '/run') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        }
        if (!body.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body is required (JSON)' }));
          return;
        }
        let json: {
          prompt?: string;
          expected?: unknown;
          task?: string;
          maxAttempts?: number;
          model?: string;
        };
        try {
          json = JSON.parse(body) as typeof json;
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }
        if (!json.prompt || typeof json.prompt !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Field "prompt" (string) is required' }));
          return;
        }

        const model = json.model ?? 'gpt-4o-mini';
        const prefixedModel = model.includes('/') ? model : `openai/${model}`;

        const agent = new ReflexionAgent({
          model: prefixedModel,
          task: json.task ?? 'api-task',
          maxAttempts: clampMaxAttempts(json.maxAttempts),
          evaluator: createFlexibleEvaluator(),
        });

        const result = await agent.run({
          prompt: json.prompt,
          expected: json.expected,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}
