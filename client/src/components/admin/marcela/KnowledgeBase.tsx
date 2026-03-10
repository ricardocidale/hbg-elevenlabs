import { useRef, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { IconBookOpen, IconUpload, IconFileUp, IconCheckCircle2, IconFileText, IconTrash, IconRefreshCw, IconDatabase, IconFileStack, IconGlobe } from "@/components/icons";
import { useUploadKBFile, useRemoveKBDocument, useKBSources, useRebuildKB, type KBSource } from "@/features/ai-agent/hooks/use-knowledge-base";
import { useAgentConfig } from "@/features/ai-agent/hooks/use-convai-api";

interface KnowledgeBaseCardProps {
  agentName: string;
}

const CATEGORY_META: Record<string, { icon: typeof IconFileStack; label: string; description: string }> = {
  "Static Reference": {
    icon: IconFileStack,
    label: "Static Reference",
    description: "Core documentation files about the portal, financials, and hospitality concepts",
  },
  "Live Data": {
    icon: IconDatabase,
    label: "Live Data",
    description: "Current portfolio data pulled from the database at rebuild time",
  },
  "Research": {
    icon: IconGlobe,
    label: "Research",
    description: "Market research and industry reports",
  },
};

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function KnowledgeBaseCard({ agentName }: KnowledgeBaseCardProps) {
  const { data: agentConfig } = useAgentConfig();
  const uploadFileMutation = useUploadKBFile();
  const removeDocMutation = useRemoveKBDocument();
  const { data: sources, isLoading: sourcesLoading } = useKBSources();
  const rebuildMutation = useRebuildKB();

  const elevenlabsKbDocs: any[] = (agentConfig?.conversation_config?.agent as any)?.knowledge_base
    ?? (agentConfig?.conversation_config?.agent?.prompt as any)?.knowledge_base ?? [];
  const hasElevenlabsDocs = elevenlabsKbDocs.length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const allSourceIds = useMemo(() => (sources ?? []).map((s) => s.id), [sources]);
  const [selectedSources, setSelectedSources] = useState<Set<string> | null>(null);

  const activeSelection = useMemo(() => {
    if (selectedSources !== null) return selectedSources;
    return new Set(allSourceIds);
  }, [selectedSources, allSourceIds]);

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev ?? allSourceIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    const categorySources = (sources ?? []).filter((s) => s.category === category).map((s) => s.id);
    const allSelected = categorySources.every((id) => activeSelection.has(id));
    setSelectedSources((prev) => {
      const next = new Set(prev ?? allSourceIds);
      categorySources.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const groupedSources = useMemo(() => {
    const groups: Record<string, KBSource[]> = {};
    for (const s of sources ?? []) {
      (groups[s.category] ??= []).push(s);
    }
    return groups;
  }, [sources]);

  const handleRebuild = () => {
    rebuildMutation.mutate(Array.from(activeSelection));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleFileUpload = () => {
    if (!selectedFile) return;
    uploadFileMutation.mutate(selectedFile, {
      onSuccess: () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  return (
    <div className="space-y-5">
      <Card className="bg-card border border-border/80 shadow-sm" data-testid="card-kb-sources">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 flex items-center justify-center">
                <IconBookOpen className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Knowledge Base Sources</CardTitle>
                <CardDescription className="label-text mt-0.5">
                  Select which content to include when rebuilding {agentName}'s knowledge base
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleRebuild}
              disabled={rebuildMutation.isPending || activeSelection.size === 0}
              className="gap-1.5 shadow-sm"
              data-testid="button-rebuild-kb"
            >
              {rebuildMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <IconRefreshCw className="w-3.5 h-3.5" />
              )}
              {rebuildMutation.isPending ? "Rebuilding..." : "Rebuild Knowledge Base"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sourcesLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground/60">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">Loading sources...</span>
            </div>
          ) : (
            Object.entries(groupedSources).map(([category, items]) => {
              const meta = CATEGORY_META[category] ?? CATEGORY_META["Static Reference"];
              const Icon = meta.icon;
              const allInCategorySelected = items.every((s) => activeSelection.has(s.id));
              const someInCategorySelected = items.some((s) => activeSelection.has(s.id));

              return (
                <div key={category} className="space-y-2">
                  <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => toggleCategory(category)}
                    data-testid={`toggle-category-${category.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Checkbox
                      checked={allInCategorySelected ? true : someInCategorySelected ? "indeterminate" : false}
                      className="pointer-events-none"
                    />
                    <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 group-hover:text-foreground transition-colors">
                      {meta.label}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {items.length}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground/50 pl-6">{meta.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-6">
                    {items.map((source) => (
                      <label
                        key={source.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                        data-testid={`source-${source.id}`}
                      >
                        <Checkbox
                          checked={activeSelection.has(source.id)}
                          onCheckedChange={() => toggleSource(source.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium text-foreground/90 truncate block">
                            {source.name}
                          </span>
                          {source.size != null && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {formatSize(source.size)}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  {category !== Object.keys(groupedSources).at(-1) && (
                    <Separator className="bg-primary/8 mt-2" />
                  )}
                </div>
              );
            })
          )}

          {rebuildMutation.isPending && (
            <div className="flex items-center gap-3 p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200/60">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-900">Rebuilding knowledge base...</p>
                <p className="text-xs text-blue-700/80 mt-0.5">
                  Compiling {activeSelection.size} sources and uploading to ElevenLabs
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-muted-foreground/50">
              {activeSelection.size} of {allSourceIds.length} sources selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setSelectedSources(new Set(allSourceIds))}
                data-testid="button-select-all-sources"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setSelectedSources(new Set())}
                data-testid="button-deselect-all-sources"
              >
                Deselect All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border/80 shadow-sm" data-testid="card-kb-elevenlabs">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 flex items-center justify-center">
              <IconBookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">ElevenLabs Knowledge Base</CardTitle>
              <CardDescription className="label-text mt-0.5">
                Documents attached to {agentName}'s Conversational AI agent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {hasElevenlabsDocs && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <IconCheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Attached Documents ({elevenlabsKbDocs.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {elevenlabsKbDocs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50/50 to-emerald-50/30 rounded-xl border border-green-200/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconFileText className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{doc.name || doc.id}</p>
                        <p className="text-[10px] text-muted-foreground/50 font-mono">{doc.type || "document"}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground/40 hover:text-red-500 shrink-0"
                      onClick={() => removeDocMutation.mutate(doc.id)}
                      disabled={removeDocMutation.isPending}
                      data-testid={`button-remove-doc-${doc.id}`}
                    >
                      {removeDocMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <IconTrash className="w-3 h-3" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="bg-primary/8" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconFileUp className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Upload Document</span>
            </div>
            <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-dashed border-muted-foreground/20">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx,.md,.csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-kb-file"
              />
              {!selectedFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 flex flex-col items-center gap-2 text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors cursor-pointer"
                  data-testid="button-select-kb-file"
                >
                  <IconFileUp className="w-8 h-8" />
                  <span className="text-sm font-medium">Select a file to upload</span>
                  <span className="text-[11px]">Supported: TXT, PDF, DOC, DOCX, MD, CSV</span>
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <IconFileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-muted-foreground/60 hover:text-foreground"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFileUpload}
                      disabled={uploadFileMutation.isPending}
                      className="gap-1.5 shadow-sm"
                      data-testid="button-upload-kb-file"
                    >
                      {uploadFileMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <IconUpload className="w-3.5 h-3.5" />
                      )}
                      {uploadFileMutation.isPending ? "Uploading..." : "Upload & Attach"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/50 px-1">
              Uploaded documents are sent to ElevenLabs and attached to {agentName}'s agent for reference during conversations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
