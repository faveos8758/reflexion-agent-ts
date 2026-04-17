import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

function getOpenAIProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  const ollamaBase = process.env.OLLAMA_BASE_URL?.replace(/\/$/, '');
  if (ollamaBase) {
    return createOpenAI({
      name: 'ollama',
      apiKey: apiKey ?? 'ollama',
      baseURL: `${ollamaBase}/v1`,
    });
  }
  return createOpenAI({ apiKey: apiKey ?? '' });
}

/**
 * Resolves a string model id (e.g. `openai/gpt-4o` or `gpt-4o`) to a Vercel AI SDK model.
 */
export function resolveLanguageModel(model: string | LanguageModel): LanguageModel {
  if (typeof model !== 'string') {
    return model;
  }
  const provider = getOpenAIProvider();
  if (model.startsWith('openai/')) {
    return provider(model.slice('openai/'.length));
  }
  return provider(model);
}
