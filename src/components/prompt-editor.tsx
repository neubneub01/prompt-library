"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Prompt, VariableSchema } from "@/lib/db/schema";
import { createNewPrompt, updateExistingPrompt, removePrompt, fetchCategories, fetchTags, type PromptFormData } from "@/actions/prompts";
import { extractVariables } from "@/lib/llm/render";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Plus,
  X,
  Trash2,
  Wand2,
  AlertCircle,
} from "lucide-react";

interface PromptEditorProps {
  prompt?: Prompt; // If provided, we're editing; otherwise creating
}

const VARIABLE_TYPES = [
  { value: "string", label: "Text (single line)" },
  { value: "text", label: "Text (multiline)" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
] as const;

export function PromptEditor({ prompt }: PromptEditorProps) {
  const router = useRouter();
  const isEditing = !!prompt;

  // Form state
  const [title, setTitle] = useState(prompt?.title || "");
  const [description, setDescription] = useState(prompt?.description || "");
  const [category, setCategory] = useState(prompt?.category || "");
  const [tags, setTags] = useState<string[]>(prompt?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [systemTemplate, setSystemTemplate] = useState(prompt?.systemTemplate || "");
  const [userTemplate, setUserTemplate] = useState(prompt?.userTemplate || "");
  const [variablesSchema, setVariablesSchema] = useState<Record<string, VariableSchema>>(
    prompt?.variablesSchema || {}
  );

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [showDeletePromptDialog, setShowDeletePromptDialog] = useState(false);
  const [variableToDelete, setVariableToDelete] = useState<string | null>(null);

  // Load existing categories and tags for autocomplete
  useEffect(() => {
    async function loadMetadata() {
      const [cats, existTags] = await Promise.all([
        fetchCategories(),
        fetchTags(),
      ]);
      setExistingCategories(cats);
      setExistingTags(existTags);
    }
    loadMetadata();
  }, []);

  // Auto-detect variables from templates
  const detectedVariables = new Set([
    ...extractVariables(systemTemplate),
    ...extractVariables(userTemplate),
  ]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAddVariable = (name: string) => {
    if (!name || variablesSchema[name]) return;
    
    setVariablesSchema(prev => ({
      ...prev,
      [name]: {
        type: "string",
        required: true,
        description: "",
        placeholder: "",
      },
    }));
  };

  const handleUpdateVariable = (name: string, updates: Partial<VariableSchema>) => {
    setVariablesSchema(prev => ({
      ...prev,
      [name]: { ...prev[name], ...updates },
    }));
  };

  const handleDeleteVariable = (name: string) => {
    setVariablesSchema(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setVariableToDelete(null);
  };

  const handleAutoDetectVariables = () => {
    detectedVariables.forEach(varName => {
      if (!variablesSchema[varName]) {
        handleAddVariable(varName);
      }
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);

    const formData: PromptFormData = {
      title,
      description: description || undefined,
      category: category || undefined,
      tags,
      systemTemplate,
      userTemplate: userTemplate || undefined,
      variablesSchema,
    };

    try {
      const result = isEditing
        ? await updateExistingPrompt(prompt.id, formData)
        : await createNewPrompt(formData);

      if (result.success && result.prompt) {
        toast.success(isEditing ? "Prompt updated successfully" : "Prompt created successfully");
        router.push(`/prompt/${result.prompt.id}`);
      } else {
        setError(result.error || "Failed to save prompt");
        toast.error(result.error || "Failed to save prompt");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePrompt = async () => {
    if (!prompt) return;
    
    setIsDeleting(true);
    try {
      const result = await removePrompt(prompt.id);
      if (result.success) {
        toast.success("Prompt deleted successfully");
        router.push("/");
      } else {
        toast.error(result.error || "Failed to delete prompt");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete prompt");
    } finally {
      setIsDeleting(false);
      setShowDeletePromptDialog(false);
    }
  };

  // Find variables in templates that aren't in schema
  const undefinedVariables = Array.from(detectedVariables).filter(
    v => !variablesSchema[v]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? "Edit Prompt" : "Create New Prompt"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? "Update your prompt template and configuration"
              : "Build a reusable prompt template with variables"}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <Button 
              variant="outline" 
              onClick={() => setShowDeletePromptDialog(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !title || !systemTemplate}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? "Save Changes" : "Create Prompt"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column - Basic info & Templates */}
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Give your prompt a clear title and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Code Review Assistant"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this prompt does..."
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select or type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Add new category</SelectItem>
                    </SelectContent>
                  </Select>
                  {category === "__new__" && (
                    <Input
                      placeholder="New category name..."
                      onChange={(e) => setCategory(e.target.value)}
                      autoFocus
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add tag..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      list="existing-tags"
                    />
                    <datalist id="existing-tags">
                      {existingTags
                        .filter((t) => !tags.includes(t))
                        .map((t) => (
                          <option key={t} value={t} />
                        ))}
                    </datalist>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddTag}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          {tag}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Template */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Template *</CardTitle>
                  <CardDescription>
                    The system instructions for the LLM. Use {"{{variable}}"} for dynamic values.
                  </CardDescription>
                </div>
                <span className="text-xs text-muted-foreground">
                  {systemTemplate.length.toLocaleString()} chars
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={systemTemplate}
                onChange={(e) => setSystemTemplate(e.target.value)}
                placeholder="You are a helpful assistant that..."
                rows={20}
                className="font-mono text-sm min-h-[400px] resize-y"
              />
            </CardContent>
          </Card>

          {/* User Template */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Template</CardTitle>
                  <CardDescription>
                    Optional template for the user message. Variables work here too.
                  </CardDescription>
                </div>
                {userTemplate && (
                  <span className="text-xs text-muted-foreground">
                    {userTemplate.length.toLocaleString()} chars
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                placeholder="Please help me with {{task}}..."
                rows={8}
                className="font-mono text-sm min-h-[150px] resize-y"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Variables */}
        <div className="space-y-6">
          {/* Variable Detection */}
          {undefinedVariables.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Wand2 className="h-4 w-4" />
                  Detected Variables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Found {undefinedVariables.length} variable(s) in your templates that aren&apos;t defined yet:
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {undefinedVariables.map((v) => (
                    <Badge key={v} variant="outline" className="font-mono">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoDetectVariables}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add All Variables
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Variables Schema */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Variables</CardTitle>
                  <CardDescription>
                    Define inputs that users can fill in when running this prompt
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const name = window.prompt("Variable name (no spaces):");
                    if (name) {
                      handleAddVariable(name.replace(/\s+/g, "_").toLowerCase());
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variable
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(variablesSchema).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No variables defined yet.</p>
                  <p className="text-sm mt-1">
                    Use {"{{variable_name}}"} in your templates, then define them here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(variablesSchema).map(([name, schema]) => (
                    <Card key={name} className="bg-muted/30">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">
                              {`{{${name}}}`}
                            </code>
                            {!detectedVariables.has(name) && (
                              <Badge variant="outline" className="text-xs text-amber-600">
                                unused
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setVariableToDelete(name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={schema.type}
                              onValueChange={(v) =>
                                handleUpdateVariable(name, { type: v as VariableSchema["type"] })
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VARIABLE_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2 pt-6">
                            <Switch
                              id={`required-${name}`}
                              checked={schema.required}
                              onCheckedChange={(checked) =>
                                handleUpdateVariable(name, { required: checked })
                              }
                            />
                            <Label htmlFor={`required-${name}`} className="text-xs">
                              Required
                            </Label>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={schema.description || ""}
                            onChange={(e) =>
                              handleUpdateVariable(name, { description: e.target.value })
                            }
                            placeholder="What should the user enter here?"
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label className="text-xs">Placeholder</Label>
                          <Input
                            value={schema.placeholder || ""}
                            onChange={(e) =>
                              handleUpdateVariable(name, { placeholder: e.target.value })
                            }
                            placeholder="Example text shown in the input..."
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label className="text-xs">Default Value</Label>
                          <Input
                            value={schema.default || ""}
                            onChange={(e) =>
                              handleUpdateVariable(name, { default: e.target.value })
                            }
                            placeholder="Pre-filled value (optional)"
                            className="h-8 text-sm"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Variable Confirmation Dialog */}
      <Dialog open={!!variableToDelete} onOpenChange={() => setVariableToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Variable</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the variable{" "}
              <code className="font-semibold">{`{{${variableToDelete}}}`}</code>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariableToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => variableToDelete && handleDeleteVariable(variableToDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Prompt Confirmation Dialog */}
      <Dialog open={showDeletePromptDialog} onOpenChange={setShowDeletePromptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Prompt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>&quot;{prompt?.title}&quot;</strong>? 
              This action cannot be undone. All associated presets will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletePromptDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePrompt}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Prompt"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
