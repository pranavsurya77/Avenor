import { openrouterClient, DEFAULT_MODEL } from './openrouter.js';

/**
 * Re-exported OpenRouter client for backwards compatibility with existing agent code.
 */
export const nvidiaClient = openrouterClient;
export { DEFAULT_MODEL };
