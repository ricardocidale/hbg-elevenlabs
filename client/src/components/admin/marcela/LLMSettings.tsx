import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { IconMessageSquare, IconMic, IconBrain, IconAlertCircle, IconSave } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { VoiceSettings, LLM_MODELS } from "./types";
import { useConversations } from "@/features/ai-agent/hooks/use-conversations";
import { useSaveAgentLlm } from "@/features/ai-agent/hooks/use-convai-api";

interface LLMSettingsProps {
  draft: VoiceSettings;
  updateField: <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => void;
}

export function LLMSettings({ draft, updateField }: LLMSettingsProps) {
  const { data: conversations } = useConversations();
  const saveAgentLlm = useSaveAgentLlm();
  const [isDirty, setIsDirty] = useState(false);

  const convList = Array.isArray(conversations) ? conversations : [];
  const failedCount = convList.filter((c: any) => c.call_successful === "failure").length;
  const total = convList.length;
  const failureRate = total > 0 ? failedCount / total : 0;
  const showTimeoutWarning = total > 0 && failureRate > 0.3;

  const handleModelChange = (v: string) => { updateField("marcelaLlmModel", v); setIsDirty(true); };
  const handleMaxTokensChange = (v: number) => { updateField("marcelaMaxTokens", v); setIsDirty(true); };

  const handleSave = () => {
    saveAgentLlm.mutate(
      { llm: draft.marcelaLlmModel, max_tokens: draft.marcelaMaxTokens },
      { onSuccess: () => setIsDirty(false) }
    );
  };

  return (
    <Card className="bg-card border border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <IconBrain className="w-4 h-4 text-muted-foreground" />
              Language Model (LLM)
            </CardTitle>
            <CardDescription className="label-text mt-1">
              Configure the AI model that powers the agent's conversation intelligence.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="outline" className="text-amber-600 border-amber-300/60 bg-amber-50/80 text-xs">
                Unsaved
              </Badge>
            )}
            <Button size="sm" onClick={handleSave} disabled={!isDirty || saveAgentLlm.isPending} className="gap-1.5 shadow-sm">
              {saveAgentLlm.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IconSave className="w-3.5 h-3.5" />}
              Save to ElevenLabs
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {showTimeoutWarning && (
          <div className="flex items-start gap-3 p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-xl border border-amber-200/60">
            <IconAlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900">High failure rate detected ({Math.round(failureRate * 100)}% of conversations)</p>
              <p className="text-xs text-amber-700/80 mt-0.5">
                LLM response timeouts are the most common cause. Consider switching to a faster model
                (e.g. <span className="font-mono">gemini-2.5-flash-lite</span> or <span className="font-mono">gpt-4o-mini</span>) or reducing Max Tokens.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label className="label-text font-medium">Chat Model</Label>
          <Select value={draft.marcelaLlmModel} onValueChange={handleModelChange}>
            <SelectTrigger className="bg-card" data-testid="select-marcela-llm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["ElevenLabs", "Google", "OpenAI", "Anthropic", "xAI", "Other"].map((provider) => {
                const models = LLM_MODELS.filter((m) => m.provider === provider);
                if (models.length === 0) return null;
                return (
                  <SelectGroup key={provider}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{provider}</SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">
                          <span>{m.label}</span>
                          <span className="text-xs text-muted-foreground">— {m.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="label-text font-medium flex items-center gap-1.5">
              <IconMessageSquare className="w-3.5 h-3.5" />
              Max Tokens (Text)
            </Label>
            <Input
              type="number"
              min={256}
              max={8192}
              value={draft.marcelaMaxTokens}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value) || 2048)}
              className="bg-card"
              data-testid="input-marcela-max-tokens"
            />
            <p className="text-xs text-muted-foreground">Maximum response length for text conversations</p>
          </div>
          <div className="space-y-2">
            <Label className="label-text font-medium flex items-center gap-1.5">
              <IconMic className="w-3.5 h-3.5" />
              Max Tokens (Voice)
            </Label>
            <Input
              type="number"
              min={128}
              max={4096}
              value={draft.marcelaMaxTokensVoice}
              onChange={(e) => updateField("marcelaMaxTokensVoice", parseInt(e.target.value) || 1024)}
              className="bg-card"
              data-testid="input-marcela-max-tokens-voice"
            />
            <p className="text-xs text-muted-foreground">Shorter for voice to keep responses conversational</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
