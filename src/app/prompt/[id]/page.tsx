import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchPromptById } from "@/actions/prompts";
import { PromptPreview } from "@/components/prompt-preview";
import { RunPanel } from "@/components/run-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, FileText } from "lucide-react";

interface PromptPageProps {
  params: Promise<{ id: string }>;
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { id } = await params;
  const prompt = await fetchPromptById(id);

  if (!prompt) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{prompt.title}</h1>
        <p className="text-muted-foreground mt-1">{prompt.description}</p>
      </div>

      <Tabs defaultValue="run" className="space-y-6">
        <TabsList>
          <TabsTrigger value="run" className="gap-2">
            <Play className="h-4 w-4" />
            Run
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2">
            <FileText className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="run">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:order-2">
              <h2 className="text-lg font-semibold mb-4">Prompt Preview</h2>
              <PromptPreview prompt={prompt} />
            </div>
            <div className="lg:order-1">
              <h2 className="text-lg font-semibold mb-4">Run Configuration</h2>
              <RunPanel prompt={prompt} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details">
          <div className="max-w-2xl">
            <PromptPreview prompt={prompt} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
