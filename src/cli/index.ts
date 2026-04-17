import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import 'dotenv/config';
import { ReflexionAgent } from '../reflexion/ReflexionAgent.js';
import { createLenientEvaluator } from '../reflexion/evaluator.js';

async function main() {
  const rl = readline.createInterface({ input, output });

  const task = await rl.question('Task (describe what the model should do): ');
  const expectedSub = (await rl.question('Optional success substring (empty = length-only check): ')).trim();

  rl.close();

  const evaluator =
    expectedSub.length > 0
      ? async (out: string) => ({
          passed: out.includes(expectedSub),
          reason: out.includes(expectedSub)
            ? undefined
            : `Output must contain the substring: ${expectedSub}`,
        })
      : createLenientEvaluator(50);

  const agent = new ReflexionAgent({
    model: 'openai/gpt-4o-mini',
    task: task.slice(0, 80) || 'cli-task',
    maxAttempts: 4,
    evaluator,
    onAttempt: (attempt, out, feedback) => {
      console.error(`\n[Attempt ${attempt}]`);
      console.error(out);
      if (feedback) {
        console.error(`[Reflexion] ${feedback}`);
      }
    },
  });

  const result = await agent.run({ prompt: task });

  console.error('');
  if (result.success) {
    console.error(`Done after ${result.attempts} attempt(s).`);
  } else {
    console.error(`Stopped after ${result.attempts} attempt(s) without passing the evaluator.`);
  }
  console.error('Final output:\n');
  console.log(result.output);
  if (result.feedbackHistory.length > 0) {
    console.error('\nFeedback history:');
    for (const f of result.feedbackHistory) {
      console.error(`- ${f}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
