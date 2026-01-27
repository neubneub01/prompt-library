import type { VariableSchema } from "../db/schema";

/**
 * Renders a template string by replacing {{variable}} placeholders with values
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  if (!template) return "";
  
  // Replace {{variable}} patterns
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    if (varName in variables) {
      return variables[varName];
    }
    // Leave unreplaced if no value provided
    return match;
  });
}

/**
 * Extract variable names from a template string
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  
  const varNames = matches.map((m) => m.slice(2, -2));
  return [...new Set(varNames)]; // Deduplicate
}

/**
 * Generate a variables schema from a template string
 * Useful for auto-generating schema from existing prompts
 */
export function generateVariablesSchema(
  template: string,
  userTemplate?: string
): Record<string, VariableSchema> {
  const vars = new Set<string>();
  
  if (template) {
    extractVariables(template).forEach((v) => vars.add(v));
  }
  if (userTemplate) {
    extractVariables(userTemplate).forEach((v) => vars.add(v));
  }
  
  const schema: Record<string, VariableSchema> = {};
  
  for (const varName of vars) {
    schema[varName] = {
      type: "string",
      required: true,
      description: `Value for ${varName}`,
      placeholder: `Enter ${varName}...`,
    };
  }
  
  return schema;
}

/**
 * Validate variables against a schema
 */
export function validateVariables(
  variables: Record<string, string>,
  schema: Record<string, VariableSchema>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [name, config] of Object.entries(schema)) {
    const value = variables[name];
    
    if (config.required && (!value || value.trim() === "")) {
      errors.push(`${name} is required`);
      continue;
    }
    
    if (value && config.type === "number" && isNaN(Number(value))) {
      errors.push(`${name} must be a number`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Apply default values from schema to variables
 */
export function applyDefaults(
  variables: Record<string, string>,
  schema: Record<string, VariableSchema>
): Record<string, string> {
  const result = { ...variables };
  
  for (const [name, config] of Object.entries(schema)) {
    if (!(name in result) && config.default) {
      result[name] = config.default;
    }
  }
  
  return result;
}
