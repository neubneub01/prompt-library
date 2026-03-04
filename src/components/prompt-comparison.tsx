"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { providers, type ProviderId } from "@/lib/llm/providers";
import type { Prompt, VariableSchema } from "@/lib/db/schema";
import { compareProviders, type CompareSlotConfig, type CompareSlotResult } from "@/actions/compare";
import { GitCompareArrows, Loader2, Copy, Check, Clock, Coins, Zap } from "lucide-react";
import { toast } from "sonner";

interface PromptComparisonProps {
  prompt: Prompt;
}

interface SlotState {
  provider: ProviderId;
  model: string;
}

const defaultSlot = (providerId: ProviderId): SlotState => ({
  provider: providerId,
  model: providers[providerId].models[0].id,
});

function SlotSelector({
  slot,
  label,
  onChange,
}: {
  slot: SlotState;
  label: string;
  onChange: (slot: SlotState) => void;
}) {
  const handleProviderChange = (newProvider: ProviderId) => {
    onChange({ provider: newProvider, model: providers[newProvider].models[0].id });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Select value={slot.provider} onValueChange={(v) => handleProviderChange(v as ProviderId)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(providers) as ProviderId[]).map((pid) => (
              <SelectItem key={pid} value={pid}>
                {providers[pid].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={slot.model} onValueChange={(m) => onChange({ ...slot, model: m })}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providers[slot.provider].models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SlotResult({
  label,
  config,
  result,
  isLoading,
}: {
  label: string;
  config: SlotState;
  result: CompareSlotResult | null;
  isLoading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (result?.text) {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const providerName = providers[config.provider].name;
  const modelName =
    providers[config.provider].models.find((m) => m.id === config.model)?.name ?? config.model;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {label}: {providerName} / {modelName}
          </CardTitle>
          {result?.text && (
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {result && !result.error && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(result.latencyMs / 1000).toFixed(2)}s
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {result.inputTokens + result.outputTokens} tokens
            </span>
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              ${result.estimatedCost.toFixed(4)}
            </span>
          </div>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Generating…
          </div>
        ) : result?.error ? (
          <p className="text-sm text-destructive whitespace-pre-wrap">{result.error}</p>
        ) : result?.text ? (
          <ScrollArea className="h-96">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{result.text}</p>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Output will appear here
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PromptComparison({ prompt }: PromptComparisonProps) {
  const [slotA, setSlotA] = useState<SlotState>(defaultSlot("openai"));
  const [slotB, setSlotB] = useState<SlotState>(defaultSlot("anthropic"));
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resultA, setResultA] = useState<CompareSlotResult | null>(null);
  const [resultB, setResultB] = useState<CompareSlotResult | null>(null);

  const variablesSchema = (prompt.variablesSchema as Record<string, VariableSchema>) ?? {};
  const hasVariables = Object.keys(variablesSchema).length > 0;

  // Initialise variable defaults whenever the prompt (or its schema) changes
  useEffect(() => {
    const schema = (prompt.variablesSchema as Record<string, VariableSchema>) ?? {};
    const defaults: Record<string, string> = {};
    for (const [name, config] of Object.entries(schema)) {
      if (config.default) defaults[name] = config.default;
    }
    setVariables(defaults);
  }, [prompt.id, prompt.variablesSchema]);

  const handleCompare = async () => {
    setIsLoading(true);
    setResultA(null);
    setResultB(null);

    try {
      const result = await compareProviders({
        promptId: prompt.id,
        systemPrompt: prompt.systemTemplate,
        userPrompt: prompt.userTemplate ?? undefined,
        variables,
        userInput: userInput.trim() || undefined,
        slotA: slotA as CompareSlotConfig,
        slotB: slotB as CompareSlotConfig,
      });

      setResultA(result.slotA);
      setResultB(result.slotB);

      if (result.slotA.error || result.slotB.error) {
        toast.error("One or more providers returned an error");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider selectors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4" />
            Configure Providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SlotSelector label="Provider A" slot={slotA} onChange={setSlotA} />
            <SlotSelector label="Provider B" slot={slotB} onChange={setSlotB} />
          </div>

          {/* Variables */}
          {hasVariables && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Variables</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(variablesSchema).map(([name, config]) => (
                    <div key={name} className="space-y-1">
                      <Label htmlFor={`var-${name}`}>
                        {name}
                        {config.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      {config.type === "text" ? (
                        <Textarea
                          id={`var-${name}`}
                          value={variables[name] ?? ""}
                          onChange={(e) =>
                            setVariables((prev) => ({ ...prev, [name]: e.target.value }))
                          }
                          placeholder={config.placeholder}
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={`var-${name}`}
                          type={config.type === "number" ? "number" : "text"}
                          value={variables[name] ?? ""}
                          onChange={(e) =>
                            setVariables((prev) => ({ ...prev, [name]: e.target.value }))
                          }
                          placeholder={config.placeholder}
                        />
                      )}
                      {config.description && (
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Additional user input */}
          <Separator />
          <div className="space-y-1">
            <Label htmlFor="user-input">Additional Input (optional)</Label>
            <Textarea
              id="user-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Any extra context or instructions to send alongside the prompt…"
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleCompare}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing…
              </>
            ) : (
              <>
                <GitCompareArrows className="mr-2 h-4 w-4" />
                Compare
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Side-by-side results */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SlotResult
          label="A"
          config={slotA}
          result={resultA}
          isLoading={isLoading}
        />
        <SlotResult
          label="B"
          config={slotB}
          result={resultB}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
