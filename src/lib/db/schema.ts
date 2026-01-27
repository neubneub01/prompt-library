import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Prompts table - stores all prompt templates
export const prompts = sqliteTable("prompts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Basic metadata
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"), // e.g., "writing", "coding", "analysis"
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  
  // Prompt templates
  systemTemplate: text("system_template").notNull(),
  userTemplate: text("user_template"),
  
  // Variables schema - JSON schema for input variables
  // e.g., { "task": { "type": "string", "required": true, "description": "The task to complete" } }
  variablesSchema: text("variables_schema", { mode: "json" }).$type<Record<string, VariableSchema>>().default({}),
  
  // Example inputs/outputs for documentation
  examples: text("examples", { mode: "json" }).$type<PromptExample[]>().default([]),
  
  // Usage tracking
  useCount: integer("use_count").default(0),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  
  // Versioning
  version: integer("version").default(1),
  sourceFile: text("source_file"), // Original markdown file path if imported
  contentHash: text("content_hash"), // For detecting changes
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Runs table - stores execution history
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Reference to prompt
  promptId: text("prompt_id").references(() => prompts.id, { onDelete: "set null" }),
  promptTitle: text("prompt_title").notNull(), // Denormalized for history when prompt is deleted
  
  // LLM configuration
  provider: text("provider").notNull(), // "openai", "anthropic", "google"
  model: text("model").notNull(), // "gpt-4o", "claude-sonnet-4-20250514", etc.
  
  // Input/Output
  variables: text("variables", { mode: "json" }).$type<Record<string, string>>().default({}),
  renderedSystemPrompt: text("rendered_system_prompt").notNull(),
  renderedUserPrompt: text("rendered_user_prompt"),
  userInput: text("user_input"), // Additional user input beyond template
  response: text("response").notNull(),
  
  // Metadata
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  latencyMs: integer("latency_ms"),
  estimatedCost: real("estimated_cost"),
  
  // Status
  status: text("status").notNull().default("completed"), // "completed", "error", "cancelled"
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Secrets table - stores API keys (encrypted in production)
export const secrets = sqliteTable("secrets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  provider: text("provider").notNull().unique(), // "openai", "anthropic", "google"
  apiKey: text("api_key").notNull(), // Should be encrypted in production
  
  // Metadata
  isValid: integer("is_valid", { mode: "boolean" }).default(true),
  lastValidatedAt: integer("last_validated_at", { mode: "timestamp" }),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Type definitions
export interface VariableSchema {
  type: "string" | "number" | "boolean" | "text"; // "text" for multiline
  required?: boolean;
  default?: string;
  description?: string;
  placeholder?: string;
  options?: string[]; // For select/dropdown
}

export interface PromptExample {
  name?: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
}

// Inferred types
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Secret = typeof secrets.$inferSelect;
export type NewSecret = typeof secrets.$inferInsert;
