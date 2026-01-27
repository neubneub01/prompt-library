"use server";

import {
  getPresetsByPromptId,
  getPresetById,
  getDefaultPreset,
  createPreset,
  updatePreset,
  deletePreset,
  setDefaultPreset,
} from "@/lib/db/queries";
import type { PromptPreset, NewPromptPreset } from "@/lib/db/schema";

export async function fetchPresetsByPromptId(promptId: string): Promise<PromptPreset[]> {
  try {
    return await getPresetsByPromptId(promptId);
  } catch (error) {
    console.error("Failed to fetch presets:", error);
    return [];
  }
}

export async function fetchPresetById(id: string): Promise<PromptPreset | null> {
  try {
    const preset = await getPresetById(id);
    return preset || null;
  } catch (error) {
    console.error("Failed to fetch preset:", error);
    return null;
  }
}

export async function fetchDefaultPreset(promptId: string): Promise<PromptPreset | null> {
  try {
    const preset = await getDefaultPreset(promptId);
    return preset || null;
  } catch (error) {
    console.error("Failed to fetch default preset:", error);
    return null;
  }
}

export async function savePreset(preset: {
  promptId: string;
  name: string;
  description?: string;
  configJson: Record<string, unknown>;
  isDefault?: boolean;
}): Promise<PromptPreset | null> {
  try {
    return await createPreset({
      promptId: preset.promptId,
      name: preset.name,
      description: preset.description,
      configJson: preset.configJson,
      isDefault: preset.isDefault || false,
    });
  } catch (error) {
    console.error("Failed to create preset:", error);
    return null;
  }
}

export async function modifyPreset(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    configJson: Record<string, unknown>;
    isDefault: boolean;
  }>
): Promise<PromptPreset | null> {
  try {
    const preset = await updatePreset(id, updates);
    return preset || null;
  } catch (error) {
    console.error("Failed to update preset:", error);
    return null;
  }
}

export async function removePreset(id: string): Promise<boolean> {
  try {
    return await deletePreset(id);
  } catch (error) {
    console.error("Failed to delete preset:", error);
    return false;
  }
}

export async function makePresetDefault(presetId: string): Promise<boolean> {
  try {
    return await setDefaultPreset(presetId);
  } catch (error) {
    console.error("Failed to set default preset:", error);
    return false;
  }
}
