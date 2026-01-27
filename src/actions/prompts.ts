"use server";

import {
  getAllPrompts,
  getPromptById,
  searchPrompts,
  getAllTags,
  getAllCategories,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "@/lib/db/queries";
import { rebuildFtsIndex } from "@/lib/db";
import type { Prompt, NewPrompt, VariableSchema } from "@/lib/db/schema";

export async function fetchPrompts(options?: {
  query?: string;
  tags?: string[];
  category?: string;
  sortBy?: "recent" | "alpha" | "most-used";
}): Promise<Prompt[]> {
  try {
    if (options?.query && options.query.trim()) {
      return searchPrompts(options.query, {
        tags: options.tags,
        category: options.category,
      });
    }
    
    return getAllPrompts({
      tags: options?.tags,
      category: options?.category,
      sortBy: options?.sortBy,
    });
  } catch (error) {
    console.error("Failed to fetch prompts:", error);
    return [];
  }
}

export async function fetchPromptById(id: string): Promise<Prompt | null> {
  try {
    const prompt = await getPromptById(id);
    return prompt || null;
  } catch (error) {
    console.error("Failed to fetch prompt:", error);
    return null;
  }
}

export async function fetchTags(): Promise<string[]> {
  try {
    return getAllTags();
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return [];
  }
}

export async function fetchCategories(): Promise<string[]> {
  try {
    return getAllCategories();
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

// Mutation actions

export interface PromptFormData {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  systemTemplate: string;
  userTemplate?: string;
  variablesSchema?: Record<string, VariableSchema>;
}

export async function createNewPrompt(data: PromptFormData): Promise<{ success: boolean; prompt?: Prompt; error?: string }> {
  try {
    // Validate required fields
    if (!data.title?.trim()) {
      return { success: false, error: "Title is required" };
    }
    if (!data.systemTemplate?.trim()) {
      return { success: false, error: "System template is required" };
    }

    const prompt = await createPrompt({
      title: data.title.trim(),
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      tags: data.tags || [],
      systemTemplate: data.systemTemplate,
      userTemplate: data.userTemplate || null,
      variablesSchema: data.variablesSchema || {},
    });

    // Rebuild FTS index to include new prompt
    rebuildFtsIndex();

    return { success: true, prompt };
  } catch (error) {
    console.error("Failed to create prompt:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create prompt" };
  }
}

export async function updateExistingPrompt(
  id: string,
  data: Partial<PromptFormData>
): Promise<{ success: boolean; prompt?: Prompt; error?: string }> {
  try {
    const updates: Partial<NewPrompt> = {};
    
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.description !== undefined) updates.description = data.description?.trim() || null;
    if (data.category !== undefined) updates.category = data.category?.trim() || null;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.systemTemplate !== undefined) updates.systemTemplate = data.systemTemplate;
    if (data.userTemplate !== undefined) updates.userTemplate = data.userTemplate || null;
    if (data.variablesSchema !== undefined) updates.variablesSchema = data.variablesSchema;

    const prompt = await updatePrompt(id, updates);
    
    if (!prompt) {
      return { success: false, error: "Prompt not found" };
    }

    // Rebuild FTS index to reflect changes
    rebuildFtsIndex();

    return { success: true, prompt };
  } catch (error) {
    console.error("Failed to update prompt:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update prompt" };
  }
}

export async function removePrompt(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const deleted = await deletePrompt(id);
    
    if (!deleted) {
      return { success: false, error: "Prompt not found" };
    }

    // Rebuild FTS index
    rebuildFtsIndex();

    return { success: true };
  } catch (error) {
    console.error("Failed to delete prompt:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete prompt" };
  }
}
