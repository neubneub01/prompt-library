import { Suspense } from "react";
import { SearchBar } from "@/components/search-bar";
import { PromptGrid } from "@/components/prompt-grid";
import { fetchPrompts, fetchTags, fetchCategories } from "@/actions/prompts";
import { fetchStats } from "@/actions/runs";
import { Skeleton } from "@/components/ui/skeleton";
import { Library, Zap, MessageSquare } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tags?: string;
    category?: string;
    sort?: string;
  }>;
}

async function StatsBar() {
  const stats = await fetchStats();
  
  return (
    <div className="flex gap-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Library className="h-4 w-4" />
        <span>{stats.totalPrompts} prompts</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Zap className="h-4 w-4" />
        <span>{stats.totalRuns} runs</span>
      </div>
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4" />
        <span>{stats.totalTokens.toLocaleString()} tokens</span>
      </div>
    </div>
  );
}

async function PromptsSection({ searchParams }: { searchParams: PageProps["searchParams"] }) {
  const params = await searchParams;
  const query = params.q || "";
  const tags = params.tags?.split(",").filter(Boolean) || [];
  const category = params.category || undefined;
  const sortBy = (params.sort as "recent" | "alpha" | "most-used") || "recent";
  
  const prompts = await fetchPrompts({
    query,
    tags: tags.length > 0 ? tags : undefined,
    category,
    sortBy,
  });

  return <PromptGrid prompts={prompts} />;
}

async function FiltersSection() {
  const [tags, categories] = await Promise.all([
    fetchTags(),
    fetchCategories(),
  ]);

  return <SearchBar tags={tags} categories={categories} />;
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Prompt Library</h1>
        </div>
        <p className="text-muted-foreground mb-4">
          Browse, search, and run your collection of AI prompts
        </p>
        <Suspense fallback={<Skeleton className="h-5 w-64" />}>
          <StatsBar />
        </Suspense>
      </div>

      <div className="space-y-6">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <FiltersSection />
        </Suspense>
        
        <Suspense fallback={<LoadingSkeleton />}>
          <PromptsSection searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
