import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { MemoryEntry, MemoryQuery, ReflexionMemory } from '../types.js';

function tokenize(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/\w+/g) ?? []) as string[]);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter++;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function similarity(prompt: string, entry: MemoryEntry): number {
  const q = tokenize(prompt);
  const p = tokenize(entry.promptSummary);
  const f = tokenize(entry.feedback);
  return jaccard(q, p) * 0.7 + jaccard(q, f) * 0.3;
}

/**
 * In-memory reflexion store with keyword similarity for retrieval (no external vector DB).
 */
export class InMemoryReflexionMemory implements ReflexionMemory {
  private entries: MemoryEntry[] = [];

  async store(entry: Omit<MemoryEntry, 'createdAt'> & { createdAt?: number }): Promise<void> {
    const full: MemoryEntry = {
      ...entry,
      createdAt: entry.createdAt ?? Date.now(),
    };
    this.entries.push(full);
  }

  async retrieveSimilar(query: MemoryQuery): Promise<string[]> {
    const limit = query.limit ?? 5;
    const sameTask = this.entries.filter((e) => e.task === query.task);
    const scored = sameTask
      .map((e) => ({ e, s: similarity(query.prompt, e) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.e.feedback);
    return scored;
  }

  async saveToFile(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const data = JSON.stringify({ entries: this.entries }, null, 0);
    await writeFile(path, data, 'utf8');
  }

  async loadFromFile(path: string): Promise<void> {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as { entries?: MemoryEntry[] };
    this.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  }

  /** @internal for tests */
  clear(): void {
    this.entries = [];
  }
}
