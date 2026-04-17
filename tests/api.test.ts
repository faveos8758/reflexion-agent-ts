import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createReflexionHttpServer } from '../src/api/reflexion-api.js';

function listen(server: ReturnType<typeof createReflexionHttpServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const a = server.address();
      if (a && typeof a === 'object') {
        resolve((a as AddressInfo).port);
      } else {
        reject(new Error('No address'));
      }
    });
    server.on('error', reject);
  });
}

describe('HTTP API', () => {
  it('GET /health returns ok', async () => {
    const server = createReflexionHttpServer();
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('GET /health matches when a query string is present', async () => {
    const server = createReflexionHttpServer();
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health?verbose=1`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('POST /run rejects empty body', async () => {
    const server = createReflexionHttpServer();
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      const j = (await res.json()) as { error?: string };
      expect(j.error).toBeDefined();
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('POST /run rejects invalid JSON', async () => {
    const server = createReflexionHttpServer();
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      expect(res.status).toBe(400);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('POST /run rejects missing prompt', async () => {
    const server = createReflexionHttpServer();
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('POST /run matches when a query string is present', async () => {
    const server = createReflexionHttpServer();
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/run?trace=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('POST /run returns 404 for unknown path', async () => {
    const server = createReflexionHttpServer();
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/nope`);
      expect(res.status).toBe(404);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
