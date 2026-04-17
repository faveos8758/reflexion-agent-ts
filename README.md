# reflexion-agent-ts

**Self-improving TypeScript agent with the Reflexion pattern** — run, fail, reflect, retry, and persist lessons.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-6.x-black)](https://sdk.vercel.ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

## What is this?

`reflexion-agent-ts` implements the **Reflexion** pattern: an agent that **learns from failed attempts** instead of repeating the same mistakes. It runs a loop of **execute → evaluate → reflect → store feedback → retry** until the evaluator passes or a max attempt count is reached.

- **Execute** — LLM produces an answer for the task.
- **Evaluate** — Your `evaluator` decides pass/fail (rules, tests, or another model).
- **Reflect** — Default reflector asks the model what went wrong; you can plug in your own.
- **Remember** — `InMemoryReflexionMemory` stores feedback and retrieves similar past lessons by **keyword similarity** (no external vector DB required). Implement `ReflexionMemory` yourself to back it with Chroma, pgvector, etc.

## Features

| Feature | Description |
|--------|-------------|
| Reflexion loop | Configurable `maxAttempts`, full `feedbackHistory` in results. |
| Evaluators | `createCodeFixEvaluator`, `createMathEvaluator`, `createLenientEvaluator`, `createFlexibleEvaluator` (API-friendly). |
| Memory | `InMemoryReflexionMemory` with `saveToFile` / `loadFromFile` for persistence. |
| REST API | `GET /health`, `POST /run` on port 3000 (configurable). |
| CLI | Interactive `npm run cli` with optional success substring. |
| Vercel AI SDK | `generateText` with OpenAI or OpenAI-compatible endpoints (e.g. Ollama). |

## Installation

```bash
cd reflexion-agent-ts
npm install
npm run build
```

Requires **Node.js 20+**.

## Environment

Copy `.env.example` to `.env`:

```env
OPENAI_API_KEY=sk-...
# Optional OpenAI-compatible API (e.g. Ollama):
# OLLAMA_BASE_URL=http://localhost:11434
PORT=3000
```

If neither `OPENAI_API_KEY` nor `OLLAMA_BASE_URL` is set, the default reflector falls back to a **template** reflector (no extra API call for reflection), which is enough for tests and offline demos.

## Quick start (library)

After `npm run build`, import from the compiled output (or add this package as a local/file dependency and use the package name):

```typescript
import { ReflexionAgent, createCodeFixEvaluator } from 'reflexion-agent-ts';

const agent = new ReflexionAgent({
  model: 'openai/gpt-4o-mini',
  task: 'fix-bug',
  maxAttempts: 3,
  evaluator: createCodeFixEvaluator(),
});

const result = await agent.run({
  prompt: 'Fix the bug: function add(a,b) { return a - b; }',
  expected: { fix: '+' },
});

console.log(`Success: ${result.success}, attempts: ${result.attempts}`);
console.log(result.output);
console.log(result.feedbackHistory.join('\n'));
```

Runnable examples (configure `.env` first):

```bash
npm run example:code
npm run example:math
```

## REST API

```bash
npm run dev
# or: npm run build && npm start
```

- `GET /health` — returns `ok`.
- `POST /run` — JSON body (paths may include a query string, e.g. `/run?trace=1`; it is ignored for routing):

```json
{
  "prompt": "Your task text",
  "task": "optional-task-label",
  "maxAttempts": 3,
  "model": "gpt-4o-mini",
  "expected": { "fix": "+" }
}
```

`expected` is optional. If omitted, the server uses a **lenient** length-based evaluator. If `expected.fix` or `expected.answer` is present, stricter evaluators are used.

`maxAttempts` is optional (default `3`), clamped between **1** and **50** on the server. The `ReflexionAgent` constructor applies the same bounds for programmatic use.

Example:

```bash
curl -s -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Fix the bug: function square(x) { return x * x; }"}'
```

## CLI

```bash
npm run cli
```

You will be prompted for a task and an optional substring that must appear in the output for success. If you leave the substring empty, success is based on minimum output length.

## How it works

```text
Task → Execute (LLM) → Evaluate
              ↑            |
              |           fail
              |            ↓
              |      Reflect + Store in memory
              |            ↓
              └──── Retry with feedback + similar lessons
```

## API reference

### `ReflexionAgent`

- `config.model` — `string` (e.g. `openai/gpt-4o-mini` or `gpt-4o-mini`) or a Vercel AI SDK `LanguageModel`.
- `config.task` — Label used for memory scoping.
- `config.maxAttempts` — Default `3`, clamped to **1–50** (invalid values fall back to `3`). Numeric strings are accepted at runtime.
- `config.evaluator` — `(output, expected?) => Promise<{ passed, reason?, score? }>`.
- `config.reflector` — Optional; default uses `generateText` when an API is configured.
- `config.memory` — Optional; default `InMemoryReflexionMemory`.
- `config.onAttempt` — Called **once per attempt**: on success `(attempt, output)`; on failure after reflection `(attempt, output, feedback)`.
- `config.generateTextOverride` — Optional; bypasses `generateText` (used in tests or custom routing).

### `createReflexionHttpServer`

- Returns a `node:http` `Server` with `GET /health` and `POST /run`. Does not call `.listen()` — safe to import in tests. Use `src/api/server.ts` (or `npm run dev` / `npm start`) for a listening process.

### `ReflexionResult`

- `success`, `output`, `attempts`, `feedbackHistory`, optional `finalFeedback` on failure.

### Memory

- `InMemoryReflexionMemory` — `store`, `retrieveSimilar`, `saveToFile`, `loadFromFile`.
- To use **Chroma** or another DB, implement the `ReflexionMemory` interface and pass it in `config.memory`.

## Docker

```bash
docker compose up --build
```

Ensure `OPENAI_API_KEY` is set in the environment or in a `.env` file used by Compose.

## Testing

```bash
npm test
npm run test:reflexion
npm run test:memory
npm run test:api
```

`tests/api.test.ts` covers `GET /health`, `POST /run`, validation, query strings on paths, and 404 handling — no live LLM. The full suite (**15 tests**) runs **offline**; no `OPENAI_API_KEY` is required for `npm test`.

## Project layout

```text
src/
  reflexion/          # Core agent, evaluators, reflector, memory
  api/reflexion-api.ts # `createReflexionHttpServer()` — no side effects (embed or test)
  api/server.ts       # Loads `.env` and listens (`npm run dev` / `npm start`; run `npm run build` before `npm start`)
  cli/index.ts        # CLI
  examples/           # Runnable examples (excluded from `tsc` output)
  index.ts            # Library exports (includes `createReflexionHttpServer`)
tests/
```

You can embed the API in your own process with `createReflexionHttpServer()` (also exported from the package root).

## Scripts and paths

If your project directory contains a colon (`:`) in its path, some systems break `PATH` for npm binaries. This repo uses explicit `node ./node_modules/...` paths in `package.json` so `build`, `test`, and `dev` work reliably.

## License

MIT

## References

- [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366)
- [Vercel AI SDK](https://sdk.vercel.ai/)
