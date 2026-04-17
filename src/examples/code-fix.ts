import 'dotenv/config';
import { ReflexionAgent, createCodeFixEvaluator } from '../reflexion/index.js';

async function main() {
  const agent = new ReflexionAgent({
    model: 'openai/gpt-4o-mini',
    task: 'fix-bug',
    maxAttempts: 3,
    evaluator: createCodeFixEvaluator(),
  });

  const result = await agent.run({
    prompt: 'Fix the bug in this function: function add(a,b) { return a - b; }',
    expected: { fix: '+' },
  });

  console.log(`Success: ${result.success} after ${result.attempts} attempts`);
  console.log('Final output:\n', result.output);
  if (result.feedbackHistory.length > 0) {
    console.log('Lessons:\n', result.feedbackHistory.join('\n'));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
