import { eq, desc, asc, sql, and, inArray } from "drizzle-orm";
import { getDb, getSqlite, prompts, runs, promptPresets, type Prompt, type NewPrompt, type Run, type NewRun, type PromptPreset, type NewPromptPreset } from "./index";

// ============ Prompt Queries ============

export async function getAllPrompts(options?: {
  sortBy?: "recent" | "alpha" | "most-used";
  tags?: string[];
  category?: string;
}) {
  const db = getDb();
  
  let query = db.select().from(prompts);
  
  // Apply filters using raw SQL for complex conditions
  const conditions: ReturnType<typeof sql>[] = [];
  
  if (options?.category) {
    conditions.push(sql`${prompts.category} = ${options.category}`);
  }
  
  // Build query with conditions
  let baseQuery = db.select().from(prompts);
  
  if (conditions.length > 0) {
    // @ts-ignore - drizzle typing issue
    baseQuery = baseQuery.where(and(...conditions));
  }
  
  // Apply sorting
  switch (options?.sortBy) {
    case "alpha":
      return baseQuery.orderBy(asc(prompts.title));
    case "most-used":
      return baseQuery.orderBy(desc(prompts.useCount));
    case "recent":
    default:
      return baseQuery.orderBy(desc(prompts.updatedAt));
  }
}

export async function getPromptById(id: string): Promise<Prompt | undefined> {
  const db = getDb();
  const result = await db.select().from(prompts).where(eq(prompts.id, id)).limit(1);
  return result[0];
}

export async function createPrompt(prompt: NewPrompt): Promise<Prompt> {
  const db = getDb();
  const result = await db.insert(prompts).values(prompt).returning();
  return result[0];
}

export async function updatePrompt(id: string, updates: Partial<NewPrompt>): Promise<Prompt | undefined> {
  const db = getDb();
  const result = await db
    .update(prompts)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(prompts.id, id))
    .returning();
  return result[0];
}

export async function deletePrompt(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(prompts).where(eq(prompts.id, id)).returning();
  return result.length > 0;
}

export async function incrementPromptUseCount(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(prompts)
    .set({
      useCount: sql`${prompts.useCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq(prompts.id, id));
}

// ============ FTS Search ============

export async function searchPrompts(
  query: string,
  options?: {
    tags?: string[];
    category?: string;
    limit?: number;
  }
): Promise<Prompt[]> {
  const sqlite = getSqlite();
  const limit = options?.limit || 50;
  
  // Build FTS query with proper escaping
  const ftsQuery = query
    .trim()
    .split(/\s+/)
    .map(term => `"${term}"*`) // Prefix matching
    .join(" ");
  
  if (!ftsQuery) {
    return getAllPrompts({ tags: options?.tags, category: options?.category });
  }
  
  // Use FTS5 MATCH query
  const stmt = sqlite.prepare(`
    SELECT p.*
    FROM prompts p
    INNER JOIN prompts_fts fts ON p.rowid = fts.rowid
    WHERE prompts_fts MATCH ?
    ORDER BY bm25(prompts_fts) -- BM25 ranking
    LIMIT ?
  `);
  
  const results = stmt.all(ftsQuery, limit) as Prompt[];
  
  // Filter by tags and category in memory (simpler than complex SQL)
  return results.filter(prompt => {
    if (options?.category && prompt.category !== options.category) {
      return false;
    }
    if (options?.tags && options.tags.length > 0) {
      const promptTags = prompt.tags || [];
      if (!options.tags.some(tag => promptTags.includes(tag))) {
        return false;
      }
    }
    return true;
  });
}

export async function getAllTags(): Promise<string[]> {
  const db = getDb();
  const results = await db.select({ tags: prompts.tags }).from(prompts);
  
  const tagSet = new Set<string>();
  for (const row of results) {
    if (row.tags) {
      for (const tag of row.tags) {
        tagSet.add(tag);
      }
    }
  }
  
  return Array.from(tagSet).sort();
}

export async function getAllCategories(): Promise<string[]> {
  const db = getDb();
  const results = await db
    .selectDistinct({ category: prompts.category })
    .from(prompts)
    .where(sql`${prompts.category} IS NOT NULL`);
  
  return results.map(r => r.category!).filter(Boolean).sort();
}

// ============ Run Queries ============

export async function createRun(run: NewRun): Promise<Run> {
  const db = getDb();
  const result = await db.insert(runs).values(run).returning();
  return result[0];
}

export async function getRunById(id: string): Promise<Run | undefined> {
  const db = getDb();
  const result = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  return result[0];
}

export async function getRunsByPromptId(promptId: string, limit = 20): Promise<Run[]> {
  const db = getDb();
  return db
    .select()
    .from(runs)
    .where(eq(runs.promptId, promptId))
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}

export async function getAllRuns(options?: {
  promptId?: string;
  provider?: string;
  limit?: number;
  offset?: number;
}): Promise<Run[]> {
  const db = getDb();
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  
  const conditions: ReturnType<typeof sql>[] = [];
  
  if (options?.promptId) {
    conditions.push(sql`${runs.promptId} = ${options.promptId}`);
  }
  if (options?.provider) {
    conditions.push(sql`${runs.provider} = ${options.provider}`);
  }
  
  let query = db.select().from(runs);
  
  if (conditions.length > 0) {
    // @ts-ignore
    query = query.where(and(...conditions));
  }
  
  return query
    .orderBy(desc(runs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function deleteRun(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(runs).where(eq(runs.id, id)).returning();
  return result.length > 0;
}

// ============ Stats ============

export async function getStats(): Promise<{
  totalPrompts: number;
  totalRuns: number;
  totalTokens: number;
}> {
  const db = getDb();
  
  const [promptCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prompts);
  
  const [runStats] = await db
    .select({
      count: sql<number>`count(*)`,
      tokens: sql<number>`coalesce(sum(${runs.totalTokens}), 0)`,
    })
    .from(runs);
  
  return {
    totalPrompts: promptCount.count,
    totalRuns: runStats.count,
    totalTokens: runStats.tokens,
  };
}

// ============ Preset Queries ============

export async function getPresetsByPromptId(promptId: string): Promise<PromptPreset[]> {
  const db = getDb();
  return db
    .select()
    .from(promptPresets)
    .where(eq(promptPresets.promptId, promptId))
    .orderBy(desc(promptPresets.isDefault), asc(promptPresets.name));
}

export async function getPresetById(id: string): Promise<PromptPreset | undefined> {
  const db = getDb();
  const result = await db.select().from(promptPresets).where(eq(promptPresets.id, id)).limit(1);
  return result[0];
}

export async function getDefaultPreset(promptId: string): Promise<PromptPreset | undefined> {
  const db = getDb();
  const result = await db
    .select()
    .from(promptPresets)
    .where(and(
      eq(promptPresets.promptId, promptId),
      eq(promptPresets.isDefault, true)
    ))
    .limit(1);
  return result[0];
}

export async function createPreset(preset: NewPromptPreset): Promise<PromptPreset> {
  const db = getDb();
  
  // If this is being set as default, unset any existing default for this prompt
  if (preset.isDefault) {
    await db
      .update(promptPresets)
      .set({ isDefault: false })
      .where(eq(promptPresets.promptId, preset.promptId));
  }
  
  const result = await db.insert(promptPresets).values(preset).returning();
  return result[0];
}

export async function updatePreset(id: string, updates: Partial<NewPromptPreset>): Promise<PromptPreset | undefined> {
  const db = getDb();
  
  // If setting as default, first get the preset to know its promptId
  if (updates.isDefault) {
    const existing = await getPresetById(id);
    if (existing) {
      await db
        .update(promptPresets)
        .set({ isDefault: false })
        .where(eq(promptPresets.promptId, existing.promptId));
    }
  }
  
  const result = await db
    .update(promptPresets)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(promptPresets.id, id))
    .returning();
  return result[0];
}

export async function deletePreset(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(promptPresets).where(eq(promptPresets.id, id)).returning();
  return result.length > 0;
}

export async function setDefaultPreset(presetId: string): Promise<boolean> {
  const db = getDb();
  
  // Get the preset to find its promptId
  const preset = await getPresetById(presetId);
  if (!preset) return false;
  
  // Unset all defaults for this prompt
  await db
    .update(promptPresets)
    .set({ isDefault: false })
    .where(eq(promptPresets.promptId, preset.promptId));
  
  // Set this one as default
  await db
    .update(promptPresets)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(promptPresets.id, presetId));
  
  return true;
}
