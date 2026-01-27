import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Provider configurations
export const providers = {
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", inputCost: 2.5, outputCost: 10 },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", inputCost: 0.15, outputCost: 0.6 },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", inputCost: 10, outputCost: 30 },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", inputCost: 0.5, outputCost: 1.5 },
      { id: "o1", name: "o1", inputCost: 15, outputCost: 60 },
      { id: "o1-mini", name: "o1-mini", inputCost: 3, outputCost: 12 },
    ],
    envKey: "OPENAI_API_KEY",
  },
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", inputCost: 3, outputCost: 15 },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", inputCost: 3, outputCost: 15 },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", inputCost: 0.8, outputCost: 4 },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", inputCost: 15, outputCost: 75 },
    ],
    envKey: "ANTHROPIC_API_KEY",
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", inputCost: 0, outputCost: 0 },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", inputCost: 1.25, outputCost: 5 },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", inputCost: 0.075, outputCost: 0.3 },
    ],
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  },
} as const;

export type ProviderId = keyof typeof providers;
export type ModelConfig = (typeof providers)[ProviderId]["models"][number];

// Get provider client
export function getProviderClient(providerId: ProviderId, apiKey?: string) {
  const provider = providers[providerId];
  const key = apiKey || process.env[provider.envKey];
  
  if (!key) {
    throw new Error(`API key not found for provider: ${providerId}. Set ${provider.envKey} environment variable.`);
  }
  
  switch (providerId) {
    case "openai":
      return createOpenAI({ apiKey: key });
    case "anthropic":
      return createAnthropic({ apiKey: key });
    case "google":
      return createGoogleGenerativeAI({ apiKey: key });
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

// Get model instance
export function getModel(providerId: ProviderId, modelId: string, apiKey?: string) {
  const client = getProviderClient(providerId, apiKey);
  return client(modelId);
}

// Calculate cost estimate
export function calculateCost(
  providerId: ProviderId,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const provider = providers[providerId];
  const model = provider.models.find((m) => m.id === modelId);
  
  if (!model) {
    return 0;
  }
  
  // Costs are per million tokens
  const inputCost = (inputTokens / 1_000_000) * model.inputCost;
  const outputCost = (outputTokens / 1_000_000) * model.outputCost;
  
  return inputCost + outputCost;
}

// Check if provider has API key configured
export function isProviderConfigured(providerId: ProviderId): boolean {
  const provider = providers[providerId];
  return !!process.env[provider.envKey];
}

// Get all configured providers
export function getConfiguredProviders(): ProviderId[] {
  return (Object.keys(providers) as ProviderId[]).filter(isProviderConfigured);
}
