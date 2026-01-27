import { notFound } from "next/navigation";
import { PromptEditor } from "@/components/prompt-editor";
import { fetchPromptById } from "@/actions/prompts";

interface EditPromptPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPromptPage({ params }: EditPromptPageProps) {
  const { id } = await params;
  const prompt = await fetchPromptById(id);

  if (!prompt) {
    notFound();
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <PromptEditor prompt={prompt} />
    </main>
  );
}
