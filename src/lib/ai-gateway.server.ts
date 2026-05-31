import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Uses Ollama's OpenAI-compatible endpoint (/v1).
 * Tool calling is handled via <ACTION> blocks in text (model-agnostic).
 */
export function createLovableAiGatewayProvider(_apiKey?: string) {
  const baseURL = process.env.LOCAL_LLM_BASE_URL ?? "http://localhost:11434/v1";
  return createOpenAICompatible({ name: "local-llm", baseURL });
}
