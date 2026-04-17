import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryReflexionMemory } from '../src/reflexion/memory/in-memory.js';

const tmpDir = join(dirname(fileURLToPath(import.meta.url)), '_tmp_memory');

describe('InMemoryReflexionMemory', () => {
  it('retrieves similar feedback for the same task', async () => {
    const m = new InMemoryReflexionMemory();
    await m.store({
      task: 'math',
      promptSummary: 'multiply large numbers',
      failedOutput: '0',
      feedback: 'Check digit alignment',
    });
    await m.store({
      task: 'math',
      promptSummary: 'multiply numbers carefully',
      failedOutput: '1',
      feedback: 'Use long multiplication',
    });

    const similar = await m.retrieveSimilar({
      task: 'math',
      prompt: 'How to multiply large integers?',
      limit: 2,
    });
    expect(similar.length).toBeGreaterThan(0);
  });

  it('saveToFile and loadFromFile round-trip', async () => {
    await mkdir(tmpDir, { recursive: true });
    const path = join(tmpDir, 'mem.json');
    const a = new InMemoryReflexionMemory();
    await a.store({
      task: 't',
      promptSummary: 'p',
      failedOutput: 'x',
      feedback: 'lesson',
    });
    await a.saveToFile(path);

    const b = new InMemoryReflexionMemory();
    await b.loadFromFile(path);
    const lessons = await b.retrieveSimilar({ task: 't', prompt: 'p', limit: 5 });
    expect(lessons).toContain('lesson');

    const raw = await readFile(path, 'utf8');
    expect(raw).toContain('lesson');

    await rm(tmpDir, { recursive: true, force: true });
  });
});
