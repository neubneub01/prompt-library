"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { providers, type ProviderId } from "@/lib/llm/providers";
import type { Prompt, VariableSchema, PromptPreset, ConfigFieldSchema } from "@/lib/db/schema";
import { fetchPresetsByPromptId, savePreset, makePresetDefault } from "@/actions/presets";
import { parseContinuation } from "@/lib/llm/continuation";
import { toast } from "sonner";
import { 
  Play, 
  Loader2, 
  Copy, 
  Check, 
  RefreshCw,
  Clock,
  Settings2,
  Save,
  Star,
  FastForward,
} from "lucide-react";

interface RunPanelProps {
  prompt: Prompt;
}

export function RunPanel({ prompt }: RunPanelProps) {
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [model, setModel] = useState<string>(providers.openai.models[0].id);
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

  // Preset state
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [configOverride, setConfigOverride] = useState<Record<string, unknown>>({});
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDescription, setNewPresetDescription] = useState("");

  // Continuation state for packetization
  const [runCount, setRunCount] = useState(0); // Track run sequence for packet numbering

  const variablesSchema = prompt.variablesSchema || {};
  const configSchema = prompt.configSchema as Record<string, ConfigFieldSchema> | null;
  const hasPresets = presets.length > 0;
  const hasConfigSchema = configSchema && Object.keys(configSchema).length > 0;

  // Parse continuation from response (memoized to avoid recalculating on every render)
  const continuation = useMemo(() => {
    if (!response || isLoading) return null;
    return parseContinuation(response);
  }, [response, isLoading]);

  // Get current effective config (preset + overrides)
  const effectiveConfig = (): Record<string, unknown> => {
    const selectedPreset = presets.find(p => p.id === selectedPresetId);
    const baseConfig = selectedPreset?.configJson || {};
    return { ...baseConfig, ...configOverride };
  };

  // Load presets
  useEffect(() => {
    async function loadPresets() {
      const loaded = await fetchPresetsByPromptId(prompt.id);
      setPresets(loaded);
      
      // Select default preset if exists
      const defaultPreset = loaded.find(p => p.isDefault);
      if (defaultPreset) {
        setSelectedPresetId(defaultPreset.id);
      } else if (loaded.length > 0) {
        setSelectedPresetId(loaded[0].id);
      }
    }
    loadPresets();
  }, [prompt.id]);

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

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    setConfigOverride({}); // Reset overrides when switching presets
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfigOverride(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveAsPreset = async () => {
    if (!newPresetName.trim()) return;
    
    const saved = await savePreset({
      promptId: prompt.id,
      name: newPresetName.trim(),
      description: newPresetDescription.trim() || undefined,
      configJson: effectiveConfig(),
      isDefault: false,
    });
    
    if (saved) {
      setPresets(prev => [...prev, saved]);
      setSelectedPresetId(saved.id);
      setConfigOverride({});
      setSaveDialogOpen(false);
      setNewPresetName("");
      setNewPresetDescription("");
      toast.success(`Preset "${saved.name}" created`);
    } else {
      toast.error("Failed to save preset");
    }
  };

  const handleSetDefault = async (presetId: string) => {
    const success = await makePresetDefault(presetId);
    if (success) {
      setPresets(prev => prev.map(p => ({
        ...p,
        isDefault: p.id === presetId,
      })));
      const preset = presets.find(p => p.id === presetId);
      toast.success(`"${preset?.name}" set as default`);
    } else {
      toast.error("Failed to set default preset");
    }
  };

  const handleRun = async (continuationInput?: string) => {
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
    setRunCount(prev => prev + 1);

    abortControllerRef.current = new AbortController();

    // Determine user input - either continuation or additional input
    const userInputToSend = continuationInput || additionalInput;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: prompt.id,
          presetId: selectedPresetId,
          configOverride: Object.keys(configOverride).length > 0 ? configOverride : undefined,
          provider,
          model,
          systemPrompt: prompt.systemTemplate,
          userPrompt: prompt.userTemplate,
          variables,
          userInput: userInputToSend,
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

  const handleContinue = () => {
    if (continuation?.prompt) {
      // Clear additional input since we're using continuation
      setAdditionalInput("");
      handleRun(continuation.prompt);
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
    setRunCount(0);
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

  const renderConfigInput = (key: string, schema: ConfigFieldSchema) => {
    const currentConfig = effectiveConfig();
    const value = key in configOverride ? configOverride[key] : currentConfig[key];
    
    if (schema.type === "boolean") {
      return (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{schema.label}</Label>
            {schema.description && (
              <p className="text-xs text-muted-foreground">{schema.description}</p>
            )}
          </div>
          <Switch
            checked={value as boolean}
            onCheckedChange={(checked) => handleConfigChange(key, checked)}
          />
        </div>
      );
    }
    
    if (schema.type === "select" && schema.options) {
      return (
        <div className="space-y-2">
          <Label>{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-muted-foreground">{schema.description}</p>
          )}
          <Select
            value={value as string}
            onValueChange={(v) => handleConfigChange(key, v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schema.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        <Label>{schema.label}</Label>
        {schema.description && (
          <p className="text-xs text-muted-foreground">{schema.description}</p>
        )}
        <Input
          value={value as string || ""}
          onChange={(e) => handleConfigChange(key, e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Preset Selection (only show if presets exist or configSchema exists) */}
      {(hasPresets || hasConfigSchema) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Preset Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>Preset</Label>
                <Select
                  value={selectedPresetId || ""}
                  onValueChange={handlePresetChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <span className="flex items-center gap-2">
                          {preset.name}
                          {preset.isDefault && (
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Config Dialog */}
              {hasConfigSchema && (
                <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="mt-8">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Configuration Toggles</DialogTitle>
                      <DialogDescription>
                        Customize the prompt behavior. Changes override the selected preset.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
                      {Object.entries(configSchema!).map(([key, schema]) => (
                        <div key={key}>
                          {renderConfigInput(key, schema)}
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setConfigOverride({})}>
                        Reset to Preset
                      </Button>
                      <Button onClick={() => setConfigDialogOpen(false)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            
            {/* Selected preset description */}
            {selectedPresetId && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {presets.find(p => p.id === selectedPresetId)?.description}
                </p>
                <div className="flex gap-1">
                  {!presets.find(p => p.id === selectedPresetId)?.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(selectedPresetId)}
                      className="text-xs"
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Set Default
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {/* Show active overrides badge */}
            {Object.keys(configOverride).length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">
                  {Object.keys(configOverride).length} override(s) active
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfigOverride({})}
                  className="h-6 text-xs"
                >
                  Reset
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          onClick={() => handleRun()} 
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
        
        {/* Save as Preset Dialog */}
        {hasConfigSchema && (
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="Save as new preset">
                <Save className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save as New Preset</DialogTitle>
                <DialogDescription>
                  Save the current configuration as a reusable preset.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Preset Name</Label>
                  <Input
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g., My Custom Config"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={newPresetDescription}
                    onChange={(e) => setNewPresetDescription(e.target.value)}
                    placeholder="Describe what this preset is for..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAsPreset} disabled={!newPresetName.trim()}>
                  Save Preset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
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
                {runCount > 1 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (Packet {runCount})
                  </span>
                )}
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
          <CardContent className="space-y-4">
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
            
            {/* Continue Button - shown when continuation prompt is detected */}
            {continuation?.found && !isLoading && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">
                    Continuation Available
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {continuation.prompt}
                  </p>
                </div>
                <Button 
                  onClick={handleContinue}
                  className="shrink-0"
                  size="sm"
                >
                  <FastForward className="mr-2 h-4 w-4" />
                  Continue
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
