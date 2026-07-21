import OpenAI from 'openai';
import { configDotenv } from 'dotenv';

// Ensure env vars are loaded
configDotenv();

const apiKey = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY || '';

if (!apiKey) {
  console.warn("⚠️ Warning: GITHUB_PAT is missing from environment variables.");
}

/**
 * Default AI model used across agents for GitHub Models API calls.
 */
export const DEFAULT_MODEL = process.env.AI_MODEL || process.env.NVIDIA_MODEL || 'gpt-4o-mini';


/**
 * Pre-configured OpenAI client connected to GitHub Models API.
 */
export const nvidiaClient = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://models.github.ai/inference',
});


