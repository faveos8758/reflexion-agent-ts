import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import { resolveLanguageModel } from './model.js';
import { createDefaultReflector, createTemplateReflector } from './reflector.js';
import { InMemoryReflexionMemory } from './memory/in-memory.js';
import type {
  ReflexionConfig,
  ReflexionMemory,
  ReflexionResult,
  ReflexionRunInput,
} from './types.js';

function normalizeMaxAttempts(raw: unknown): number {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseInt(raw, 10)
        : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(50, Math.floor(n));
}

export class ReflexionAgent {
  private readonly model: LanguageModel;
  private readonly task: string;
  private readonly maxAttempts: number;
  private readonly evaluator: ReflexionConfig['evaluator'];
  private readonly reflector: NonNullable<ReflexionConfig['reflector']>;
  private readonly memory: ReflexionMemory;
  private readonly onAttempt?: ReflexionConfig['onAttempt'];
  private readonly generateTextOverride?: ReflexionConfig['generateTextOverride'];

  constructor(config: ReflexionConfig) {
    this.model = resolveLanguageModel(config.model);
    this.task = config.task;
    this.maxAttempts = normalizeMaxAttempts(config.maxAttempts ?? 3);
    this.evaluator = config.evaluator;
    this.memory = config.memory ?? new InMemoryReflexionMemory();
    this.generateTextOverride = config.generateTextOverride;
    if (config.reflector) {
      this.reflector = config.reflector;
    } else if (process.env.OPENAI_API_KEY || process.env.OLLAMA_BASE_URL) {
      this.reflector = createDefaultReflector(this.model);
    } else {
      this.reflector = createTemplateReflector();
    }
    this.onAttempt = config.onAttempt;
  }

  async run(input: ReflexionRunInput): Promise<ReflexionResult> {
    const feedbackHistory: string[] = [];
    let userPrompt = input.prompt;
    let lastOutput = '';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const output = await this.generate(userPrompt);
      lastOutput = output;

      const evaluation = await this.evaluator(output, input.expected);
      if (evaluation.passed) {
        this.onAttempt?.(attempt, output);
        return {
          success: true,
          output,
          attempts: attempt,
          feedbackHistory,
        };
      }

      const reason = evaluation.reason ?? 'Output did not satisfy the evaluator.';
      const feedback = await this.reflector(input.prompt, output, reason);
      feedbackHistory.push(feedback);
      this.onAttempt?.(attempt, output, feedback);

      await this.memory.store({
        task: this.task,
        promptSummary: input.prompt.slice(0, 500),
        failedOutput: output.slice(0, 8000),
        feedback,
      });

      const similar = await this.memory.retrieveSimilar({
        task: this.task,
        prompt: input.prompt,
        limit: 3,
      });
      const memoryBlock =
        similar.length > 0
          ? `\nPast lessons from similar failures:\n${similar.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
          : '';

      userPrompt = `${input.prompt}\n\nYour previous attempt failed. Feedback:\n${feedback}${memoryBlock}\n\nProduce an improved answer that addresses the feedback.`;
    }

    return {
      success: false,
      output: lastOutput,
      attempts: this.maxAttempts,
      feedbackHistory,
      finalFeedback: feedbackHistory[feedbackHistory.length - 1],
    };
  }

  private async generate(prompt: string): Promise<string> {
    if (this.generateTextOverride) {
      const { text } = await this.generateTextOverride({
        model: this.model,
        system: `You are a helpful assistant. Task type: ${this.task}. Follow instructions carefully.`,
        prompt,
      });
      return text;
    }
    const { text } = await generateText({
      model: this.model,
      system: `You are a helpful assistant. Task type: ${this.task}. Follow instructions carefully.`,
      prompt,
    });
    return text;
  }
}
