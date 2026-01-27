"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Prompt, PromptExample } from "@/lib/db/schema";
import { FileText, User, Lightbulb } from "lucide-react";

interface PromptPreviewProps {
  prompt: Prompt;
}

export function PromptPreview({ prompt }: PromptPreviewProps) {
  const examples = prompt.examples || [];
  
  return (
    <div className="space-y-6">
      {/* Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">{prompt.title}</h3>
            <p className="text-sm text-muted-foreground">
              {prompt.description || "No description"}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {prompt.category && (
              <Badge variant="secondary">{prompt.category}</Badge>
            )}
            {prompt.tags?.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            <div>Version: {prompt.version}</div>
            <div>Uses: {prompt.useCount}</div>
            {prompt.lastUsedAt && (
              <div>
                Last used: {new Date(prompt.lastUsedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Template */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <CardTitle className="text-base">System Prompt</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded-md">
              {prompt.systemTemplate}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* User Template */}
      {prompt.userTemplate && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <CardTitle className="text-base">User Template</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded-md">
                {prompt.userTemplate}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Examples */}
      {examples.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              <CardTitle className="text-base">Examples</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {examples.map((example, index) => (
                <AccordionItem key={index} value={`example-${index}`}>
                  <AccordionTrigger className="text-sm">
                    {example.name || `Example ${index + 1}`}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-medium mb-1">Inputs:</h4>
                        <pre className="text-xs font-mono bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(example.inputs, null, 2)}
                        </pre>
                      </div>
                      {example.expectedOutput && (
                        <div>
                          <h4 className="text-xs font-medium mb-1">
                            Expected Output:
                          </h4>
                          <pre className="text-xs font-mono bg-muted p-2 rounded whitespace-pre-wrap">
                            {example.expectedOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
