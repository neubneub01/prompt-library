"use client";

import { useState, useRef, useEffect } from "react";
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
import { providers, type ProviderId } from "@/lib/llm/providers";
import type { Prompt, VariableSchema } from "@/lib/db/schema";
import { 
  Play, 
  Loader2, 
  Copy, 
  Check, 
  RefreshCw,
  Clock,
} from "lucide-react";

interface RunPanelProps {
  prompt: Prompt;
}

export function RunPanel({ prompt }: RunPanelProps) {
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [model, setModel] = useState(providers.openai.models[0].id);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [additionalInput, setAdditionalInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const variablesSchema = prompt.variablesSchema || {};

  // Initialize variables with defaults
  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const [name, config] of Object.entries(variablesSchema)) {
      if (config.default) {
        defaults[name] = config.default;
      }
    }
    setVariables(defaults);
  }, [prompt.id]);

  // Scroll to bottom on new response content and scroll into view
  useEffect(() => {
    if (responseRef.current) {
      // Scroll the response container to bottom as new content arrives
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // Scroll the response card into view when loading starts
  useEffect(() => {
    if (isLoading && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isLoading]);

  const handleProviderChange = (newProvider: ProviderId) => {
    setProvider(newProvider);
    setModel(providers[newProvider].models[0].id);
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
  };

  const handleRun = async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setResponse("");
    setError(null);
    setLatency(null);
    const currentStartTime = Date.now();
    setStartTime(currentStartTime);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: prompt.id,
          provider,
          model,
          systemPrompt: prompt.systemTemplate,
          userPrompt: prompt.userTemplate,
          variables,
          userInput: additionalInput,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || "Request failed");
        } catch {
          throw new Error(errorText || "Request failed");
        }
      }

      // Handle streaming response (plain text stream)
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setResponse(fullText);
      }

      setLatency(Date.now() - currentStartTime);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (response) {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setResponse("");
    setError(null);
    setLatency(null);
    setAdditionalInput("");
    setIsLoading(false);
  };

  const providerModels = providers[provider].models;

  const renderVariableInput = (name: string, config: VariableSchema) => {
    if (config.options && config.options.length > 0) {
      return (
        <Select
          value={variables[name] || ""}
          onValueChange={(value) => handleVariableChange(name, value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={config.placeholder || `Select ${name}`} />
          </SelectTrigger>
          <SelectContent>
            {config.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (config.type === "text") {
      return (
        <Textarea
          value={variables[name] || ""}
          onChange={(e) => handleVariableChange(name, e.target.value)}
          placeholder={config.placeholder}
          rows={4}
        />
      );
    }

    return (
      <Input
        type={config.type === "number" ? "number" : "text"}
        value={variables[name] || ""}
        onChange={(e) => handleVariableChange(name, e.target.value)}
        placeholder={config.placeholder}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Model Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => handleProviderChange(v as ProviderId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(providers).map(([id, config]) => (
                    <SelectItem key={id} value={id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variables */}
      {Object.keys(variablesSchema).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Variables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(variablesSchema).map(([name, config]) => (
              <div key={name} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {name}
                  {config.required && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                {config.description && (
                  <p className="text-xs text-muted-foreground">
                    {config.description}
                  </p>
                )}
                {renderVariableInput(name, config)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Additional Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Additional Input</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={additionalInput}
            onChange={(e) => setAdditionalInput(e.target.value)}
            placeholder="Add any additional context or instructions..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          type="button"
          onClick={handleRun} 
          disabled={isLoading} 
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Prompt
            </>
          )}
        </Button>
        {(response || error) && (
          <>
            <Button variant="outline" size="icon" onClick={handleCopy} disabled={!response}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="icon" onClick={handleClear}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Response */}
      {(isLoading || response) && !error && (
        <Card className="border-primary/50 bg-muted/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Response
              </CardTitle>
              {latency && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(latency / 1000).toFixed(2)}s
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div 
              ref={responseRef}
              className="h-[400px] overflow-y-auto rounded-md border bg-background p-4"
            >
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {response || (
                  <span className="text-muted-foreground animate-pulse">
                    Generating response...
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
