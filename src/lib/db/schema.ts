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
  
  // Config schema - defines valid preset configuration options for this prompt
  // e.g., { "depth_mode": { "type": "select", "options": ["MVP", "Production", "Enterprise"] } }
  configSchema: text("config_schema", { mode: "json" }).$type<Record<string, ConfigFieldSchema>>(),
  
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

// Prompt Presets table - stores reusable configuration presets for prompts
export const promptPresets = sqliteTable("prompt_presets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Reference to prompt
  promptId: text("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  
  // Preset metadata
  name: text("name").notNull(), // "MVP", "Production", "Enterprise"
  description: text("description"),
  
  // Configuration JSON - the actual preset values
  // e.g., { "depth_mode": "MVP", "packetization": true, "decision_budget": "strict" }
  configJson: text("config_json", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  
  // Default flag - only one preset per prompt should be default
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Runs table - stores execution history
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Reference to prompt and preset
  promptId: text("prompt_id").references(() => prompts.id, { onDelete: "set null" }),
  promptTitle: text("prompt_title").notNull(), // Denormalized for history when prompt is deleted
  presetId: text("preset_id").references(() => promptPresets.id, { onDelete: "set null" }),
  
  // LLM configuration
  provider: text("provider").notNull(), // "openai", "anthropic", "google"
  model: text("model").notNull(), // "gpt-4o", "claude-sonnet-4-20250514", etc.
  
  // Input/Output
  variables: text("variables", { mode: "json" }).$type<Record<string, string>>().default({}),
  configJson: text("config_json", { mode: "json" }).$type<Record<string, unknown>>(), // Config used for this run
  renderedSystemPrompt: text("rendered_system_prompt").notNull(),
  renderedUserPrompt: text("rendered_user_prompt"),
  userInput: text("user_input"), // Additional user input beyond template
  response: text("response").notNull(),
  
  // Continuation support for packetization
  continuationPrompt: text("continuation_prompt"), // Extracted "NEXT PROMPT TO CONTINUE" if present
  parentRunId: text("parent_run_id"), // Links to previous run in a continuation chain
  
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

// Config field schema - defines a single configurable option for presets
export interface ConfigFieldSchema {
  type: "select" | "boolean" | "string";
  label: string;
  description?: string;
  options?: string[]; // For select type
  default?: string | boolean;
}

// App Architect specific config type (for type safety in presets)
export interface AppArchitectConfig {
  depth_mode: "MVP" | "Production" | "Enterprise";
  packetization: boolean;
  decision_budget: "strict" | "relaxed";
  structure_bias: "single" | "monorepo";
  include_auth: "auto" | "force" | "skip";
  include_testing: "auto" | "force" | "skip";
}

// Inferred types
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Secret = typeof secrets.$inferSelect;
export type NewSecret = typeof secrets.$inferInsert;
export type PromptPreset = typeof promptPresets.$inferSelect;
export type NewPromptPreset = typeof promptPresets.$inferInsert;
