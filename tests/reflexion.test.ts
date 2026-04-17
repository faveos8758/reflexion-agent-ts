import { describe, expect, it } from 'vitest';
import { ReflexionAgent } from '../src/reflexion/ReflexionAgent.js';
import { createCodeFixEvaluator } from '../src/reflexion/evaluator.js';

describe('ReflexionAgent', () => {
  it('succeeds on first attempt when evaluator passes', async () => {
    let n = 0;
    const agent = new ReflexionAgent({
      model: 'openai/gpt-4o-mini',
      task: 'test',
      maxAttempts: 3,
      evaluator: async (output) => ({ passed: output.includes('OK'), reason: 'need OK' }),
      reflector: async () => 'retry',
      generateTextOverride: async () => {
        n++;
        return { text: 'OK' };
      },
    });

    const result = await agent.run({ prompt: 'say OK' });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.output).toContain('OK');
    expect(n).toBe(1);
  });

  it('retries and succeeds when second attempt passes', async () => {
    let n = 0;
    const agent = new ReflexionAgent({
      model: 'openai/gpt-4o-mini',
      task: 'test',
      maxAttempts: 3,
      evaluator: async (output) => ({ passed: output.includes('OK'), reason: 'need OK' }),
      reflector: async () => 'You must output OK',
      generateTextOverride: async () => {
        n++;
        return { text: n === 1 ? 'no' : 'OK' };
      },
    });

    const result = await agent.run({ prompt: 'test' });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.feedbackHistory.length).toBe(1);
  });

  it('returns failure when max attempts exhausted', async () => {
    const agent = new ReflexionAgent({
      model: 'openai/gpt-4o-mini',
      task: 'test',
      maxAttempts: 2,
      evaluator: async () => ({ passed: false, reason: 'never' }),
      reflector: async () => 'again',
      generateTextOverride: async () => ({ text: 'fail' }),
    });

    const result = await agent.run({ prompt: 'x' });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.finalFeedback).toBeDefined();
  });

  it('coerces numeric string maxAttempts (runtime JSON-style values)', async () => {
    let calls = 0;
    const agent = new ReflexionAgent({
      model: 'openai/gpt-4o-mini',
      task: 'test',
      maxAttempts: '2' as unknown as number,
      evaluator: async () => ({ passed: false, reason: 'never' }),
      reflector: async () => 'retry',
      generateTextOverride: async () => {
        calls++;
        return { text: 'fail' };
      },
    });

    await agent.run({ prompt: 'x' });
    expect(calls).toBe(2);
  });

  it('uses default maxAttempts when config is invalid (e.g. 0)', async () => {
    let calls = 0;
    const agent = new ReflexionAgent({
      model: 'openai/gpt-4o-mini',
      task: 'test',
      maxAttempts: 0,
      evaluator: async () => ({ passed: false, reason: 'never' }),
      reflector: async () => 'retry',
      generateTextOverride: async () => {
        calls++;
        return { text: 'fail' };
      },
    });

    const result = await agent.run({ prompt: 'x' });
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
  });

  it('code-fix evaluator integrates with reflexion override', async () => {
    let n = 0;
    const agent = new ReflexionAgent({
      model: 'openai/gpt-4o-mini',
      task: 'fix-bug',
      maxAttempts: 3,
      evaluator: createCodeFixEvaluator(),
      reflector: async () => 'use +',
      generateTextOverride: async () => {
        n++;
        return { text: n === 1 ? 'return a - b' : 'return a + b' };
      },
    });

    const result = await agent.run({
      prompt: 'fix add',
      expected: { fix: '+' },
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });
});
