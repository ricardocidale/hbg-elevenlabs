import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, X } from "lucide-react";
import { IconVolume2, IconWaves, IconAudioLines, IconZap, IconGauge, IconTimer, IconClock, IconSettings2, IconSave, IconMusic, IconSparkles, IconInfo, IconPlus, IconExternalLink } from "@/components/icons";
import { VoiceSettings, OUTPUT_FORMATS, TTS_MODEL_FAMILIES, SUGGESTED_AUDIO_TAGS_OPTIONS } from "./types";
import { DEFAULT_MARCELA_STABILITY, DEFAULT_MARCELA_SIMILARITY_BOOST, DEFAULT_MARCELA_SPEED, DEFAULT_MARCELA_SILENCE_END_CALL_TIMEOUT, DEFAULT_MARCELA_MAX_DURATION, DEFAULT_MARCELA_TURN_TIMEOUT } from "@shared/constants";
import { useAgentConfig, useSaveAgentVoice } from "@/features/ai-agent/hooks/use-convai-api";

interface VoiceSettingsProps {
  draft: VoiceSettings;
  updateField: <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => void;
}

export function VoiceSettingsComponent({ draft, updateField }: VoiceSettingsProps) {
  const saveAgentVoice = useSaveAgentVoice();
  const [voiceDirty, setVoiceDirty] = useState(false);

  const { data: agentConfig, isLoading: agentLoading } = useAgentConfig();

  const liveTts = agentConfig?.conversation_config?.tts;
  const liveModelId = liveTts?.model_id ?? "eleven_flash_v2_5";
  const liveExpressiveMode = liveTts?.expressive_mode ?? false;
  const liveAudioTags: string[] = liveTts?.suggested_audio_tags ?? [];

  const [modelId, setModelId] = useState(liveModelId);
  const [expressiveMode, setExpressiveMode] = useState(liveExpressiveMode);
  const [audioTags, setAudioTags] = useState<string[]>(liveAudioTags);
  const [ttsDirty, setTtsDirty] = useState(false);

  useEffect(() => {
    if (!agentLoading && agentConfig) {
      setModelId(liveModelId);
      setExpressiveMode(liveExpressiveMode);
      setAudioTags(liveAudioTags);
      setTtsDirty(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentLoading, agentConfig?.agent_id]);

  const isV3 = modelId === "eleven_v3_conversational";

  const handleModelChange = useCallback((value: string) => {
    setModelId(value);
    if (value === "eleven_v3_conversational") {
      setExpressiveMode(true);
    }
    setTtsDirty(true);
  }, []);

  const handleExpressiveToggle = useCallback((value: boolean) => {
    setExpressiveMode(value);
    setTtsDirty(true);
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setAudioTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 20 ? [...prev, tag] : prev;
      return next;
    });
    setTtsDirty(true);
  }, []);

  const removeTag = useCallback((tag: string) => {
    setAudioTags(prev => prev.filter(t => t !== tag));
    setTtsDirty(true);
  }, []);

  const handleSaveTts = () => {
    saveAgentVoice.mutate({
      model_id: modelId,
      expressive_mode: isV3 ? expressiveMode : undefined,
      suggested_audio_tags: isV3 ? audioTags : undefined,
    }, { onSuccess: () => setTtsDirty(false) });
  };

  const handleVoiceField = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    updateField(key, value);
    setVoiceDirty(true);
  };

  const handleSaveVoice = () => {
    saveAgentVoice.mutate({
      voice_id: draft.marcelaVoiceId,
      stability: draft.marcelaStability,
      similarity_boost: draft.marcelaSimilarityBoost,
      use_speaker_boost: draft.marcelaSpeakerBoost,
      speed: draft.marcelaSpeed,
      agent_output_audio_format: draft.marcelaOutputFormat,
      turn_timeout: draft.marcelaTurnTimeout,
      silence_end_call_timeout: draft.marcelaSilenceEndCallTimeout,
      max_duration_seconds: draft.marcelaMaxDuration,
    }, { onSuccess: () => setVoiceDirty(false) });
  };

  const selectedModel = TTS_MODEL_FAMILIES.find(m => m.value === modelId);
  const selectedTags = audioTags;
  const availableTags = SUGGESTED_AUDIO_TAGS_OPTIONS.filter(t => !selectedTags.includes(t));

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconMusic className="w-4 h-4 text-muted-foreground" />
                TTS Model Family
              </CardTitle>
              <CardDescription className="label-text mt-1">
                Select the ElevenLabs TTS model for Marcela's voice. See{" "}
                <code className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded">.claude/skills/codebase-architecture/SKILL.md</code>{" "}
                § ElevenLabs for architecture details.{" "}
                <a
                  href="https://elevenlabs.io/docs/overview/capabilities/text-to-speech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  ElevenLabs docs <IconExternalLink className="w-3 h-3" />
                </a>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {ttsDirty && (
                <Badge variant="outline" className="text-amber-600 border-amber-300/60 bg-amber-50/80 text-xs">
                  Unsaved
                </Badge>
              )}
              <Button size="sm" onClick={handleSaveTts} disabled={!ttsDirty || saveAgentVoice.isPending} className="gap-1.5 shadow-sm" data-testid="button-save-tts-model">
                {saveAgentVoice.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IconSave className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {agentLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading live configuration from ElevenLabs...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Select value={modelId} onValueChange={handleModelChange}>
                  <SelectTrigger className="bg-card" data-testid="select-tts-model-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_MODEL_FAMILIES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">
                          <span>{m.label}</span>
                          {"badge" in m && m.badge && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal">{m.badge}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">— {m.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModel && (
                  <p className="text-xs text-muted-foreground">
                    Model ID: <code className="font-mono bg-muted px-1 py-0.5 rounded">{selectedModel.value}</code>
                  </p>
                )}
              </div>

              {isV3 && (
                <>
                  <Separator />

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                    <div>
                      <Label className="label-text font-medium flex items-center gap-1.5">
                        <IconSparkles className="w-3.5 h-3.5" />
                        Expressive mode
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Context-aware delivery that adapts tone across conversational turns
                      </p>
                    </div>
                    <Switch
                      checked={expressiveMode}
                      onCheckedChange={handleExpressiveToggle}
                      data-testid="switch-expressive-mode"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Label className="label-text font-medium">Suggested audio tags</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <IconInfo className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-sm">
                            <p className="text-xs font-semibold mb-1">Suggested Audio Tags (V3 Only)</p>
                            <p className="text-xs mb-1.5">Audio tags guide Marcela's vocal delivery. The LLM outputs these as inline cues like [laughs] or [whispers] during conversation. Max 20 tags.</p>
                            <p className="text-xs text-muted-foreground">Configuration: <span className="font-mono text-[10px]">.claude/skills/codebase-architecture/SKILL.md</span> § ElevenLabs. Voice settings are synced live to the ElevenLabs ConvAI agent via the admin API.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="text-xs text-muted-foreground ml-auto">{selectedTags.length}/20</span>
                    </div>

                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTags.map(tag => (
                          <Badge
                            key={tag}
                            variant="default"
                            className="text-xs px-2 py-0.5 gap-1 cursor-pointer hover:bg-primary/80"
                            onClick={() => removeTag(tag)}
                            data-testid={`badge-audio-tag-active-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {tag}
                            <X className="w-3 h-3" />
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map(tag => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs px-2 py-0.5 gap-1 cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => toggleTag(tag)}
                          data-testid={`badge-audio-tag-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <IconPlus className="w-3 h-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                      <IconInfo className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      Voice settings (Stability, Speed, Similarity) are not customizable for V3 models.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border border-border/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconVolume2 className="w-4 h-4 text-muted-foreground" />
                Voice Synthesis
              </CardTitle>
              <CardDescription className="label-text mt-1">
                Core voice settings pushed to ElevenLabs.{isV3 ? " These controls are disabled for V3 models." : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {voiceDirty && (
                <Badge variant="outline" className="text-amber-600 border-amber-300/60 bg-amber-50/80 text-xs">
                  Unsaved
                </Badge>
              )}
              <Button size="sm" onClick={handleSaveVoice} disabled={!voiceDirty || saveAgentVoice.isPending || isV3} className="gap-1.5 shadow-sm">
                {saveAgentVoice.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IconSave className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`space-y-5 ${isV3 ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="space-y-2">
            <Label className="label-text font-medium">Voice ID</Label>
            <Input
              value={draft.marcelaVoiceId}
              onChange={(e) => handleVoiceField("marcelaVoiceId", e.target.value)}
              placeholder="ElevenLabs voice ID"
              className="bg-card font-mono text-sm"
              data-testid="input-marcela-voice-id"
            />
            <p className="text-xs text-muted-foreground">Default: Jessica Anne Bogart (cgSgspJ2msm6clMCkdW9)</p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="label-text font-medium flex items-center gap-1.5">
                  <IconWaves className="w-3.5 h-3.5" />
                  Stability
                </Label>
                <Badge variant="outline" className="font-mono text-xs">
                  {(draft.marcelaStability ?? DEFAULT_MARCELA_STABILITY).toFixed(2)}
                </Badge>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[draft.marcelaStability ?? DEFAULT_MARCELA_STABILITY]}
                onValueChange={([v]) => handleVoiceField("marcelaStability", v)}
                data-testid="slider-marcela-stability"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More variable & expressive</span>
                <span>More stable & consistent</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="label-text font-medium flex items-center gap-1.5">
                  <IconAudioLines className="w-3.5 h-3.5" />
                  Similarity Boost
                </Label>
                <Badge variant="outline" className="font-mono text-xs">
                  {(draft.marcelaSimilarityBoost ?? DEFAULT_MARCELA_SIMILARITY_BOOST).toFixed(2)}
                </Badge>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[draft.marcelaSimilarityBoost ?? DEFAULT_MARCELA_SIMILARITY_BOOST]}
                onValueChange={([v]) => handleVoiceField("marcelaSimilarityBoost", v)}
                data-testid="slider-marcela-similarity"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More diverse, less like original</span>
                <span>Closer to original voice</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="label-text font-medium flex items-center gap-1.5">
                  <IconGauge className="w-3.5 h-3.5" />
                  Speed
                </Label>
                <Badge variant="outline" className="font-mono text-xs">
                  {(draft.marcelaSpeed ?? DEFAULT_MARCELA_SPEED).toFixed(2)}x
                </Badge>
              </div>
              <Slider
                min={0.5}
                max={2.0}
                step={0.05}
                value={[draft.marcelaSpeed ?? DEFAULT_MARCELA_SPEED]}
                onValueChange={([v]) => handleVoiceField("marcelaSpeed", v)}
                data-testid="slider-marcela-speed"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slower</span>
                <span>Normal (1.0x)</span>
                <span>Faster</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div>
              <Label className="label-text font-medium flex items-center gap-1.5">
                <IconZap className="w-3.5 h-3.5" />
                Speaker Boost
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Amplifies voice clarity at the cost of slightly higher latency
              </p>
            </div>
            <Switch
              checked={draft.marcelaSpeakerBoost}
              onCheckedChange={(v) => handleVoiceField("marcelaSpeakerBoost", v)}
              data-testid="switch-marcela-speaker-boost"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <IconSettings2 className="w-4 h-4 text-muted-foreground" />
            Conversation Settings
          </CardTitle>
          <CardDescription className="label-text">
            Timeouts and audio pipeline configuration. Additional turn-taking, ASR, and VAD settings are managed in the ElevenLabs dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="label-text font-medium">Output Format</Label>
            <Select value={draft.marcelaOutputFormat} onValueChange={(v) => handleVoiceField("marcelaOutputFormat", v)}>
              <SelectTrigger className="bg-card" data-testid="select-marcela-output-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <div className="flex items-center gap-2">
                      <span>{f.label}</span>
                      <span className="text-xs text-muted-foreground">— {f.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="label-text font-medium flex items-center gap-1.5">
                <IconTimer className="w-3.5 h-3.5" />
                Turn Timeout
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.marcelaTurnTimeout ?? DEFAULT_MARCELA_TURN_TIMEOUT}
                  onChange={(e) => handleVoiceField("marcelaTurnTimeout", parseInt(e.target.value) || DEFAULT_MARCELA_TURN_TIMEOUT)}
                  className="bg-card"
                  data-testid="input-marcela-turn-timeout"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">sec</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Wait time for user response before agent speaks again
              </p>
            </div>

            <div className="space-y-2">
              <Label className="label-text font-medium flex items-center gap-1.5">
                <IconClock className="w-3.5 h-3.5" />
                Silence End Call
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={600}
                  value={draft.marcelaSilenceEndCallTimeout ?? DEFAULT_MARCELA_SILENCE_END_CALL_TIMEOUT}
                  onChange={(e) => handleVoiceField("marcelaSilenceEndCallTimeout", parseInt(e.target.value) || DEFAULT_MARCELA_SILENCE_END_CALL_TIMEOUT)}
                  className="bg-card"
                  data-testid="input-marcela-silence-end-call"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">sec</span>
              </div>
              <p className="text-xs text-muted-foreground">
                End call after this many seconds of silence
              </p>
            </div>

            <div className="space-y-2">
              <Label className="label-text font-medium flex items-center gap-1.5">
                <IconClock className="w-3.5 h-3.5" />
                Max Duration
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={60}
                  max={3600}
                  value={draft.marcelaMaxDuration ?? DEFAULT_MARCELA_MAX_DURATION}
                  onChange={(e) => handleVoiceField("marcelaMaxDuration", parseInt(e.target.value) || DEFAULT_MARCELA_MAX_DURATION)}
                  className="bg-card"
                  data-testid="input-marcela-max-duration"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">sec</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum conversation length
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
