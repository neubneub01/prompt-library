import { streamText, type CoreMessage } from "ai";
import { getModel, calculateCost, type ProviderId } from "@/lib/llm/providers";
import { renderTemplate } from "@/lib/llm/render";
import { createRun, incrementPromptUseCount, getPromptById } from "@/lib/db/queries";
import type { NewRun } from "@/lib/db/schema";

export const maxDuration = 60;

interface ChatRequest {
  promptId?: string;
  provider: ProviderId;
  model: string;
  systemPrompt: string;
  userPrompt?: string;
  variables?: Record<string, string>;
  userInput?: string;
}

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();
    const { promptId, provider, model, systemPrompt, userPrompt, variables = {}, userInput } = body;

    // Validate required fields
    if (!provider || !model || !systemPrompt) {
      return Response.json(
        { error: "Missing required fields: provider, model, systemPrompt" },
        { status: 400 }
      );
    }

    // Render templates with variables
    const renderedSystem = renderTemplate(systemPrompt, variables);
    const renderedUser = userPrompt ? renderTemplate(userPrompt, variables) : undefined;

    // Build messages
    const messages: CoreMessage[] = [];
    
    if (renderedUser) {
      messages.push({ role: "user", content: renderedUser });
    }
    
    if (userInput) {
      messages.push({ role: "user", content: userInput });
    }

    if (messages.length === 0) {
      messages.push({ role: "user", content: "Please respond based on the system instructions." });
    }

    // Get model instance
    const modelInstance = getModel(provider, model);

    // Track timing
    const startTime = Date.now();

    // Stream the response
    const result = streamText({
      model: modelInstance,
      system: renderedSystem,
      messages,
      onFinish: async ({ text, usage }) => {
        const latencyMs = Date.now() - startTime;
        const inputTokens = usage.promptTokens;
        const outputTokens = usage.completionTokens;
        const estimatedCost = calculateCost(provider, model, inputTokens, outputTokens);

        // Get prompt title for history
        let promptTitle = "Ad-hoc prompt";
        if (promptId) {
          try {
            const prompt = await getPromptById(promptId);
            if (prompt) {
              promptTitle = prompt.title;
              await incrementPromptUseCount(promptId);
            }
          } catch {
            // Ignore errors getting prompt
          }
        }

        // Save run to history
        const run: NewRun = {
          promptId: promptId || null,
          promptTitle,
          provider,
          model,
          variables,
          renderedSystemPrompt: renderedSystem,
          renderedUserPrompt: renderedUser,
          userInput,
          response: text,
          inputTokens,
          outputTokens,
          totalTokens: (inputTokens || 0) + (outputTokens || 0),
          latencyMs,
          estimatedCost,
          status: "completed",
        };

        try {
          await createRun(run);
        } catch {
          // Ignore errors saving run
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
