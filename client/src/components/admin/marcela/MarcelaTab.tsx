import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SaveButton } from "@/components/ui/save-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconShield, IconMic, IconBrain, IconPhone, IconUser, IconHistory, IconCheckCircle2, IconXCircle, IconPlay, IconPalette, IconMousePointerClick, IconAlertTriangle, IconRefreshCw, IconRadio, IconInfo } from "@/components/icons";
import { Orb, AgentState } from "@/features/ai-agent/components/orb";
import { ConversationBar } from "@/features/ai-agent/components/conversation-bar";
import { VoiceSettings } from "./types";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useMarcelaSettings, useSaveMarcelaSettings, useTwilioStatus } from "@/features/ai-agent/hooks/use-agent-settings";
import { useGlobalAssumptions } from "../hooks";
import { useAgentConfig } from "@/features/ai-agent/hooks/use-convai-api";
import { useConversations } from "@/features/ai-agent/hooks/use-conversations";
import { useAdminSignedUrl } from "@/features/ai-agent/hooks/use-signed-url";
import { LLMSettings } from "./LLMSettings";
import { TelephonySettings } from "./TelephonySettings";
import { VoiceSettingsComponent } from "./VoiceSettings";
import { PromptEditor } from "./PromptEditor";
import { ConversationHistory } from "./ConversationHistory";
import { WidgetAppearance } from "./WidgetAppearance";
import { WidgetInteraction } from "./WidgetInteraction";

// ── Status Checklist ──────────────────────────────────────────────────────────

interface ChecklistItem { label: string; ok: boolean; tab?: string }

function StatusChecklist({ items, onNavigate }: { items: ChecklistItem[]; onNavigate: (tab: string) => void }) {
  return (
    <Card className="bg-card border border-border/80 shadow-sm" data-testid="card-agent-checklist">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <IconShield className="w-4 h-4 text-muted-foreground" />
          Agent Readiness
        </CardTitle>
        <CardDescription className="label-text mt-0.5">
          All systems must be green for full agent functionality.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={!item.tab}
              onClick={() => item.tab && onNavigate(item.tab)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                item.ok
                  ? "border-green-200/60 bg-green-50/40 text-green-800"
                  : "border-red-200/60 bg-red-50/40 text-red-800"
              } ${item.tab ? "cursor-pointer hover:shadow-sm" : "cursor-default"}`}
              data-testid={`checklist-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.ok
                ? <IconCheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                : <IconXCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface MarcelaTabProps { initialTab?: string }

export default function MarcelaTab({ initialTab }: MarcelaTabProps) {
  const { toast } = useToast();
  const { data: globalData, isLoading, isError, refetch } = useMarcelaSettings();
  const { data: twilioStatus } = useTwilioStatus();
  const saveMutation = useSaveMarcelaSettings();
  const { data: agentConfig, error: agentConfigError } = useAgentConfig();
  const { data: conversations } = useConversations();
  const { data: signedUrl, isLoading: signedUrlLoading, isError: signedUrlError } = useAdminSignedUrl();
  const { data: healthData } = useQuery<{ apiKeySet: boolean; agentId: string; signedUrlTest: string; showAiAssistant: boolean; marcelaEnabled: boolean }>({
    queryKey: ["admin", "convai-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/convai/health", { credentials: "include" });
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
    staleTime: 30_000,
    retry: false,
  });
  const [testOpen, setTestOpen] = useState(false);
  const [orbAgentState, setOrbAgentState] = useState<AgentState>(null);

  const [draft, setDraft] = useState<VoiceSettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "general");

  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => { if (globalData && !draft) setDraft({ ...globalData }); }, [globalData, draft]);

  useEffect(() => {
    if (!testOpen) { setOrbAgentState(null); return; }
    const states: AgentState[] = ["thinking", "listening", "talking", "listening"];
    let i = 0;
    setOrbAgentState(states[0]);
    const id = setInterval(() => { i = (i + 1) % states.length; setOrbAgentState(states[i]); }, 2500);
    return () => clearInterval(id);
  }, [testOpen]);

  useEffect(() => {
    if (signedUrlError) {
      toast({ title: "Widget signed URL failed", description: "ElevenLabs signed URL could not be generated. Check the agent ID and API key.", variant: "destructive" });
    }
  }, [signedUrlError]);

  const updateField = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (draft) saveMutation.mutate(draft, { onSuccess: () => setIsDirty(false) });
  };

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (isLoading || (!isError && !draft)) {
    return (
      <div className="space-y-6 mt-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-card border border-border/80">
            <CardHeader>
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-72 bg-muted animate-pulse rounded mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 bg-muted animate-pulse rounded" />
                <div className="h-10 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !draft) {
    return (
      <div className="mt-6 p-8 flex flex-col items-center gap-4 text-center rounded-xl border border-amber-200/60 bg-amber-50/40">
        <IconAlertTriangle className="w-10 h-10 text-amber-500" />
        <div>
          <p className="font-semibold text-foreground">Failed to load AI Agent settings</p>
          <p className="text-sm text-muted-foreground mt-1">Check your connection or try again.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <IconRefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const { data: globalAssumptions } = useGlobalAssumptions();
  const companyName = globalAssumptions?.companyName || "the company";
  const agentName = draft.aiAgentName || "AI Agent";
  const elevenLabsOk = !agentConfigError && agentConfig !== undefined;
  const signedUrlOk = !!signedUrl;
  const promptOk = !!(agentConfig?.conversation_config?.agent?.prompt?.prompt);
  const kbDocs: any[] = (agentConfig?.conversation_config?.agent as any)?.knowledge_base
    ?? (agentConfig?.conversation_config?.agent?.prompt as any)?.knowledge_base ?? [];
  const kbOk = kbDocs.length > 0;
  const twilioOk = !!twilioStatus?.connected;
  const agentIdOk = !!draft.marcelaAgentId;

  const checklistItems: ChecklistItem[] = [
    { label: "Agent ID", ok: agentIdOk, tab: "general" },
    { label: "ElevenLabs API", ok: elevenLabsOk, tab: "general" },
    { label: "Signed URL", ok: signedUrlOk },
    { label: "System prompt", ok: promptOk, tab: "intelligence" },
    { label: "Knowledge base", ok: kbOk },
    { label: "Twilio", ok: twilioOk, tab: "channels" },
  ];

  // ── Tab definitions ─────────────────────────────────────────────────────────

  const tabs = [
    { value: "general",      label: "General",      icon: IconShield },
    { value: "intelligence",  label: "Intelligence", icon: IconBrain },
    { value: "voice",         label: "Voice",        icon: IconMic },
    { value: "appearance",    label: "Appearance",   icon: IconPalette },
    { value: "interaction",   label: "Interaction",  icon: IconMousePointerClick },
    { value: "channels",      label: "Channels",     icon: IconPhone },
    { value: "history",       label: "History",      icon: IconHistory },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">AI Agent Configuration</h2>
          <p className="text-muted-foreground text-sm">Manage {agentName} — intelligence, voice, appearance, and channels.</p>
        </div>
        <div className="flex items-center gap-3">
          {draft.marcelaAgentId && (
            <Button size="sm" variant="outline" onClick={() => setTestOpen(true)} className="gap-1.5 border-border text-muted-foreground hover:bg-muted" data-testid="button-test-conversation">
              <IconPlay className="w-3.5 h-3.5" /> Test
            </Button>
          )}
          <SaveButton onClick={handleSave} disabled={!isDirty} isPending={saveMutation.isPending} />
        </div>
      </div>

      {draft.marcelaAgentId && (
        <StatusChecklist items={checklistItems} onNavigate={setActiveTab} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-7 h-auto p-1 bg-muted border border-border">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="py-2 gap-2"
              data-testid={`tab-ai-agent-${t.value}`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden md:inline text-xs">{t.label}</span>
              {t.value === "history" && conversations && conversations.length > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                  {conversations.length > 99 ? "99+" : conversations.length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6 space-y-6">
          {/* ── General ────────────────────────────────────────────────────── */}
          <TabsContent value="general" className="space-y-6 m-0 focus-visible:outline-none">
            <Card className="bg-card border border-border/80 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                      <Orb colors={["#9fbca4", "#4a7c5c"]} agentState={agentConfig ? "thinking" : null} seed={42} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-foreground">Agent Identity</CardTitle>
                      <CardDescription className="label-text mt-0.5">
                        Core settings for {agentName} — display name, agent ID, and global toggles.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={draft.marcelaEnabled ? "default" : "secondary"} className="text-sm">
                    {draft.marcelaEnabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <IconUser className="w-4 h-4 text-muted-foreground/60" />
                    <Label className="label-text font-medium text-xs uppercase tracking-wider text-muted-foreground/70">Agent Display Name</Label>
                  </div>
                  <Input
                    value={draft.aiAgentName}
                    onChange={(e) => updateField("aiAgentName", e.target.value)}
                    placeholder="Enter the AI agent's display name"
                    className="bg-card border-border focus:border-border transition-colors max-w-sm"
                    data-testid="input-ai-agent-name"
                  />
                  <p className="text-xs text-muted-foreground/70 pl-6">
                    Shown in the chat widget, phone greetings, and SMS replies.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="label-text font-medium text-xs uppercase tracking-wider text-muted-foreground/70">ElevenLabs Agent ID</Label>
                  <Input
                    value={draft.marcelaAgentId}
                    onChange={(e) => updateField("marcelaAgentId", e.target.value)}
                    placeholder="Enter your ElevenLabs Agent ID"
                    className="bg-card font-mono text-sm border-border focus:border-border transition-colors"
                    data-testid="input-ai-agent-id"
                  />
                  <p className="text-xs text-muted-foreground/70">
                    Create an agent at{" "}
                    <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline">
                      elevenlabs.io/app/conversational-ai
                    </a>{" "}and paste the Agent ID here.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-muted/60">
                  <div>
                    <Label className="label-text font-medium">AI Chat Widget</Label>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Show the {agentName} chat bubble on all pages for logged-in users</p>
                  </div>
                  <Switch checked={draft.showAiAssistant} onCheckedChange={(v) => updateField("showAiAssistant", v)} data-testid="switch-show-ai-assistant" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-muted/60">
                  <div>
                    <Label className="label-text font-medium">Voice Conversations</Label>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Allow users to speak with {agentName} using microphone input and audio playback</p>
                  </div>
                  <Switch checked={draft.marcelaEnabled} onCheckedChange={(v) => updateField("marcelaEnabled", v)} data-testid="switch-ai-agent-enabled" />
                </div>

                {agentConfig?.name && (
                  <div className="p-3 bg-muted/30 rounded-xl border border-border/60">
                    <p className="text-xs text-muted-foreground">
                      ElevenLabs agent name: <span className="font-semibold text-foreground">{agentConfig.name}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Widget Status */}
            <Card className="bg-card border border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <IconRadio className="w-4 h-4 text-muted-foreground" /> Widget Status
                </CardTitle>
                <CardDescription className="label-text mt-0.5">
                  Live connection diagnostics for the {agentName} widget.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Widget Visible</span>
                  {draft.showAiAssistant
                    ? <span className="flex items-center gap-1 text-xs text-green-700"><IconCheckCircle2 className="w-3.5 h-3.5 text-green-500" />On</span>
                    : <span className="flex items-center gap-1 text-xs text-amber-600"><IconXCircle className="w-3.5 h-3.5 text-amber-400" />Off — toggle "AI Chat Widget" above</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Agent ID</span>
                  {agentIdOk
                    ? <span className="flex items-center gap-1 text-xs text-green-700"><IconCheckCircle2 className="w-3.5 h-3.5 text-green-500" />Configured</span>
                    : <span className="flex items-center gap-1 text-xs text-muted-foreground"><IconXCircle className="w-3.5 h-3.5 text-red-400" />Missing</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">API Key</span>
                  {healthData?.apiKeySet
                    ? <span className="flex items-center gap-1 text-xs text-green-700"><IconCheckCircle2 className="w-3.5 h-3.5 text-green-500" />Set</span>
                    : healthData?.apiKeySet === false
                    ? <span className="flex items-center gap-1 text-xs text-destructive"><IconXCircle className="w-3.5 h-3.5" />Missing — add ELEVENLABS_API_KEY secret</span>
                    : <span className="text-xs text-muted-foreground animate-pulse">Checking…</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Signed URL</span>
                  {signedUrlLoading
                    ? <span className="text-xs text-muted-foreground animate-pulse">Generating…</span>
                    : signedUrlError
                    ? <span className="flex items-center gap-1 text-xs text-destructive"><IconXCircle className="w-3.5 h-3.5" />Failed</span>
                    : signedUrl
                    ? <span className="flex items-center gap-1 text-xs text-green-700"><IconCheckCircle2 className="w-3.5 h-3.5 text-green-500" />Ready</span>
                    : <span className="text-xs text-muted-foreground">Unavailable</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ElevenLabs API</span>
                  {elevenLabsOk
                    ? <span className="flex items-center gap-1 text-xs text-green-700"><IconCheckCircle2 className="w-3.5 h-3.5 text-green-500" />Connected</span>
                    : <span className="flex items-center gap-1 text-xs text-destructive"><IconXCircle className="w-3.5 h-3.5" />Error</span>}
                </div>
                {signedUrlError && (
                  <p className="text-xs text-destructive pt-1">
                    {healthData?.apiKeySet === false
                      ? "ELEVENLABS_API_KEY environment secret is not set. Add it in your Replit Secrets."
                      : !agentIdOk
                      ? "Agent ID is not configured. Enter a valid ElevenLabs Agent ID above."
                      : "Check the ElevenLabs agent ID and API key — signed URL generation failed."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tools summary (read-only) */}
            {agentConfig?.conversation_config?.agent?.prompt?.tools && (
              <div className="flex gap-3 p-3 bg-muted/30 border border-border/60 rounded-lg">
                <IconInfo className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {(agentConfig.conversation_config.agent.prompt.tools as any[]).length} tools
                  </span>{" "}
                  registered on ElevenLabs. Tools are managed in the{" "}
                  <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="underline">
                    ElevenLabs dashboard
                  </a>.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Intelligence (Prompt + LLM) ──────────────────────────────── */}
          <TabsContent value="intelligence" className="space-y-6 m-0 focus-visible:outline-none">
            <PromptEditor agentName={agentName} companyName={companyName} />
            <LLMSettings draft={draft} updateField={updateField} />
          </TabsContent>

          {/* ── Voice ──────────────────────────────────────────────────────── */}
          <TabsContent value="voice" className="space-y-6 m-0 focus-visible:outline-none">
            <VoiceSettingsComponent draft={draft} updateField={updateField} />
          </TabsContent>

          {/* ── Appearance ─────────────────────────────────────────────────── */}
          <TabsContent value="appearance" className="space-y-6 m-0 focus-visible:outline-none">
            <WidgetAppearance />
          </TabsContent>

          {/* ── Interaction ────────────────────────────────────────────────── */}
          <TabsContent value="interaction" className="space-y-6 m-0 focus-visible:outline-none">
            <WidgetInteraction draft={draft} updateField={updateField} />
          </TabsContent>

          {/* ── Channels ───────────────────────────────────────────────────── */}
          <TabsContent value="channels" className="space-y-6 m-0 focus-visible:outline-none">
            <TelephonySettings draft={draft} updateField={updateField} twilioStatus={twilioStatus} companyName={companyName} />
          </TabsContent>

          {/* ── History ────────────────────────────────────────────────────── */}
          <TabsContent value="history" className="space-y-6 m-0 focus-visible:outline-none">
            <ErrorBoundary fallback={
              <div className="p-6 rounded-xl border border-amber-200/60 bg-amber-50/40 flex flex-col items-center gap-3 text-center">
                <IconAlertTriangle className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="font-medium text-foreground text-sm">Conversation history failed to load</p>
                  <p className="text-xs text-muted-foreground mt-1">An error occurred in this section. Other tabs are unaffected.</p>
                </div>
                <button onClick={() => window.location.reload()} className="text-xs underline text-muted-foreground hover:text-foreground">Reload page</button>
              </div>
            }>
              <ConversationHistory />
            </ErrorBoundary>
          </TabsContent>
        </div>
      </Tabs>

      {/* Test Conversation Dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Test Conversation</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-28 h-28">
              <Orb colors={["#9fbca4", "#4a7c5c"]} agentState={orbAgentState} seed={42} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold font-display">{agentName}</p>
              <p className="text-[11px] text-muted-foreground/60 capitalize">{orbAgentState ?? "idle"}</p>
            </div>
            {signedUrl ? (
              <>
                <p className="text-xs text-muted-foreground/60 text-center px-2">
                  Live conversation — counts against your ElevenLabs quota.
                </p>
                <ConversationBar signedUrl={signedUrl} agentLabel={agentName} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground/60 animate-pulse">Generating signed URL…</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
