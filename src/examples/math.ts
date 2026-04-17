import 'dotenv/config';
import { ReflexionAgent, createMathEvaluator, extractNumber } from '../reflexion/index.js';

async function main() {
  const agent = new ReflexionAgent({
    model: 'openai/gpt-4o-mini',
    task: 'math',
    maxAttempts: 5,
    evaluator: createMathEvaluator(),
  });

  const expected = 1234 * 5678;
  const result = await agent.run({
    prompt: 'What is 1234 * 5678? Reply with the numeric answer only.',
    expected: { answer: expected },
  });

  console.log(`Success: ${result.success}, attempts: ${result.attempts}`);
  console.log('Model output:', result.output);
  console.log('Parsed number:', extractNumber(result.output));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
