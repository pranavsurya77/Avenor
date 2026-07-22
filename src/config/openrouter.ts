import OpenAI from 'openai';
import { configDotenv } from 'dotenv';

// Ensure env vars are loaded
configDotenv();

const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';

if (!apiKey) {
  console.warn("⚠️ Warning: OPENROUTER_API_KEY is missing from environment variables.");
}

/**
 * Default AI model used across agents for OpenRouter API calls.
 */
export const DEFAULT_MODEL = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';

/**
 * Pre-configured OpenAI client connected to OpenRouter API.
 */
export const openrouterClient = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com',
    'X-Title': 'Software Maintenance Engineer',
  },
});

/**
 * Extended chat completion message type that supports OpenRouter reasoning_details.
 */
export type ORChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam & {
  reasoning_details?: unknown;
};

/**
 * Helper function to create chat completions with OpenRouter reasoning enabled.
 */
export async function createOpenRouterCompletion(params: OpenAI.Chat.Completions.ChatCompletionCreateParams & {
  reasoning?: { enabled: boolean };
}) {
  return await openrouterClient.chat.completions.create(params as any);
}
