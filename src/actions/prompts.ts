"use server";

import {
  getAllPrompts,
  getPromptById,
  searchPrompts,
  getAllTags,
  getAllCategories,
} from "@/lib/db/queries";
import type { Prompt } from "@/lib/db/schema";

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
