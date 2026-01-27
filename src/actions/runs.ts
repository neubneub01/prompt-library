"use server";

import {
  getAllRuns,
  getRunById,
  getRunsByPromptId,
  deleteRun,
  getStats,
} from "@/lib/db/queries";
import type { Run } from "@/lib/db/schema";

export async function fetchRuns(options?: {
  promptId?: string;
  provider?: string;
  limit?: number;
  offset?: number;
}): Promise<Run[]> {
  try {
    return getAllRuns(options);
  } catch (error) {
    console.error("Failed to fetch runs:", error);
    return [];
  }
}

export async function fetchRunById(id: string): Promise<Run | null> {
  try {
    const run = await getRunById(id);
    return run || null;
  } catch (error) {
    console.error("Failed to fetch run:", error);
    return null;
  }
}

export async function fetchRunsByPromptId(
  promptId: string,
  limit = 20
): Promise<Run[]> {
  try {
    return getRunsByPromptId(promptId, limit);
  } catch (error) {
    console.error("Failed to fetch runs for prompt:", error);
    return [];
  }
}

export async function removeRun(id: string): Promise<boolean> {
  try {
    return deleteRun(id);
  } catch (error) {
    console.error("Failed to delete run:", error);
    return false;
  }
}

export async function fetchStats(): Promise<{
  totalPrompts: number;
  totalRuns: number;
  totalTokens: number;
}> {
  try {
    return getStats();
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return { totalPrompts: 0, totalRuns: 0, totalTokens: 0 };
  }
}
