/**
 * Assembly pipeline for constructing system messages with preset configurations
 * This is the "switchboard" that injects ARCHITECT_CONFIG blocks into prompts
 */

import { renderTemplate } from "./render";

/**
 * Build the ARCHITECT_CONFIG block from a config object
 * Uses YAML-style formatting for LLM readability
 */
export function buildConfigBlock(config: Record<string, unknown>): string {
  const lines = ["ARCHITECT_CONFIG:"];
  
  for (const [key, value] of Object.entries(config)) {
    // Format value appropriately
    const formattedValue = typeof value === "boolean" 
      ? (value ? "true" : "false")
      : String(value);
    lines.push(`  ${key}: ${formattedValue}`);
  }
  
  lines.push(""); // Empty line before prompt
  return lines.join("\n");
}

/**
 * Assemble the final system message with optional config injection
 * 
 * @param systemTemplate - The core system prompt template
 * @param variables - Variables to render in the template
 * @param configJson - Optional preset config to inject as ARCHITECT_CONFIG block
 * @returns The fully assembled system message
 */
export function assembleSystemMessage(
  systemTemplate: string,
  variables: Record<string, string>,
  configJson?: Record<string, unknown> | null
): string {
  // First render the template with variables
  const renderedSystem = renderTemplate(systemTemplate, variables);
  
  // If no config, return rendered template as-is
  if (!configJson || Object.keys(configJson).length === 0) {
    return renderedSystem;
  }
  
  // Prepend the config block
  return buildConfigBlock(configJson) + renderedSystem;
}

/**
 * Parse a config JSON string safely
 */
export function parseConfigJson(configJson: string | null | undefined): Record<string, unknown> | null {
  if (!configJson) return null;
  
  try {
    const parsed = JSON.parse(configJson);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
