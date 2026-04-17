import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { ReflectorFunction } from './types.js';

export function createDefaultReflector(model: LanguageModel): ReflectorFunction {
  return async (originalPrompt, failedOutput, evaluationReason) => {
    const { text } = await generateText({
      model,
      system:
        'You write concise reflective feedback for a failed attempt. Be specific: what went wrong and what to do next time.',
      prompt: `Original task:\n${originalPrompt}\n\nFailed output:\n${failedOutput}\n\nEvaluation:\n${evaluationReason}\n\nWrite 2-4 sentences: what went wrong and exactly what to do next time.`,
    });
    return text.trim();
  };
}

/** Template-based reflector when no API key is available (tests / offline). */
export function createTemplateReflector(): ReflectorFunction {
  return async (_originalPrompt, failedOutput, evaluationReason) =>
    `You failed because: ${evaluationReason}. Your output was: ${failedOutput.slice(0, 200)}${failedOutput.length > 200 ? '…' : ''}. Next time, address the evaluation feedback precisely.`;
}
