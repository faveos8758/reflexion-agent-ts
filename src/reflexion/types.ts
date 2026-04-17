import type { LanguageModel } from 'ai';

export type EvaluatorFunction = (
  output: string,
  expected?: unknown,
) => Promise<{ passed: boolean; score?: number; reason?: string }>;

export type ReflectorFunction = (
  originalPrompt: string,
  failedOutput: string,
  evaluationReason: string,
) => Promise<string>;

export interface MemoryEntry {
  task: string;
  promptSummary: string;
  failedOutput: string;
  feedback: string;
  createdAt: number;
}

export interface MemoryQuery {
  task: string;
  prompt: string;
  limit?: number;
}

export interface ReflexionMemory {
  store(entry: Omit<MemoryEntry, 'createdAt'> & { createdAt?: number }): Promise<void>;
  retrieveSimilar(query: MemoryQuery): Promise<string[]>;
  saveToFile(path: string): Promise<void>;
  loadFromFile(path: string): Promise<void>;
}

export interface ReflexionConfig {
  model: string | LanguageModel;
  task: string;
  /** Clamped to 1–50 (default 3). String values (e.g. from loose JSON) are parsed. */
  maxAttempts?: number | string;
  evaluator: EvaluatorFunction;
  reflector?: ReflectorFunction;
  memory?: ReflexionMemory;
  onAttempt?: (attempt: number, output: string, feedback?: string) => void;
  /** Optional hook for tests or custom routing; bypasses `generateText` when set. */
  generateTextOverride?: (options: {
    model: LanguageModel;
    system?: string;
    prompt: string;
  }) => Promise<{ text: string }>;
}

export interface ReflexionRunInput {
  prompt: string;
  expected?: unknown;
}

export interface ReflexionResult {
  success: boolean;
  output: string;
  attempts: number;
  feedbackHistory: string[];
  finalFeedback?: string;
}
