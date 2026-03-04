"use server";

import { generateText } from "ai";
import { getModel, calculateCost, type ProviderId } from "@/lib/llm/providers";
import { assembleSystemMessage } from "@/lib/llm/assemble";
import { renderTemplate } from "@/lib/llm/render";
import { createRun, getPromptById, incrementPromptUseCount } from "@/lib/db/queries";

export interface CompareSlotConfig {
  provider: ProviderId;
  model: string;
}

export interface CompareRequest {
  promptId?: string;
  systemPrompt: string;
  userPrompt?: string;
  variables?: Record<string, string>;
  userInput?: string;
  slotA: CompareSlotConfig;
  slotB: CompareSlotConfig;
}

export interface CompareSlotResult {
  text: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  runId?: string;
  error?: string;
}

export interface CompareResult {
  slotA: CompareSlotResult;
  slotB: CompareSlotResult;
}

async function runSingleSlot(
  config: CompareSlotConfig,
  renderedSystem: string,
  messages: Array<{ role: "user"; content: string }>,
  promptId: string | undefined,
  promptTitle: string,
  renderedUser: string | undefined,
  userInput: string | undefined,
  variables: Record<string, string>
): Promise<CompareSlotResult> {
  const startTime = Date.now();
  const modelInstance = getModel(config.provider, config.model);

  const { text, usage } = await generateText({
    model: modelInstance,
    system: renderedSystem,
    messages,
  });

  const latencyMs = Date.now() - startTime;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const estimatedCost = calculateCost(config.provider, config.model, inputTokens, outputTokens);

  let runId: string | undefined;
  try {
    const run = await createRun({
      promptId: promptId ?? null,
      promptTitle,
      provider: config.provider,
      model: config.model,
      variables,
      renderedSystemPrompt: renderedSystem,
      renderedUserPrompt: renderedUser,
      userInput,
      response: text,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs,
      estimatedCost,
      status: "completed",
    });
    runId = run.id;
  } catch {
    // Ignore db errors so the comparison result is still returned
  }

  return { text, latencyMs, inputTokens, outputTokens, estimatedCost, runId };
}

export async function compareProviders(
  request: CompareRequest
): Promise<CompareResult> {
  const {
    promptId,
    systemPrompt,
    userPrompt,
    variables = {},
    userInput,
    slotA,
    slotB,
  } = request;

  const renderedSystem = assembleSystemMessage(systemPrompt, variables, undefined);
  const renderedUser = userPrompt ? renderTemplate(userPrompt, variables) : undefined;

  const messages: Array<{ role: "user"; content: string }> = [];
  if (renderedUser) messages.push({ role: "user", content: renderedUser });
  if (userInput) messages.push({ role: "user", content: userInput });
  if (messages.length === 0) {
    messages.push({ role: "user", content: "Please respond based on the system instructions." });
  }

  let promptTitle = "Ad-hoc prompt";
  if (promptId) {
    try {
      const prompt = await getPromptById(promptId);
      if (prompt) promptTitle = prompt.title;
    } catch {
      // Ignore
    }
  }

  // Run both providers simultaneously
  const [resultA, resultB] = await Promise.allSettled([
    runSingleSlot(slotA, renderedSystem, messages, promptId, promptTitle, renderedUser, userInput, variables),
    runSingleSlot(slotB, renderedSystem, messages, promptId, promptTitle, renderedUser, userInput, variables),
  ]);

  if (promptId) {
    try {
      await incrementPromptUseCount(promptId);
    } catch {
      // Ignore
    }
  }

  const toError = (reason: unknown): CompareSlotResult => ({
    text: "",
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    error: reason instanceof Error ? reason.message : "Unknown error",
  });

  return {
    slotA: resultA.status === "fulfilled" ? resultA.value : toError(resultA.reason),
    slotB: resultB.status === "fulfilled" ? resultB.value : toError(resultB.reason),
  };
}
