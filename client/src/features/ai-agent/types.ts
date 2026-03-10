export interface VoiceSettings {
  aiAgentName: string;
  marcelaAgentId: string;
  marcelaVoiceId: string;
  marcelaTtsModel: string;
  marcelaSttModel: string;
  marcelaOutputFormat: string;
  marcelaStability: number;
  marcelaSimilarityBoost: number;
  marcelaSpeakerBoost: boolean;
  marcelaChunkSchedule: string;
  marcelaLlmModel: string;
  marcelaMaxTokens: number;
  marcelaMaxTokensVoice: number;
  marcelaEnabled: boolean;
  showAiAssistant: boolean;
  marcelaTwilioEnabled: boolean;
  marcelaSmsEnabled: boolean;
  marcelaPhoneGreeting: string;
  marcelaLanguage: string;
  marcelaTurnTimeout: number;
  marcelaAvatarUrl: string;
  marcelaWidgetVariant: string;
  marcelaSpeed: number;
  marcelaStreamingLatency: number;
  marcelaTextNormalisation: string;
  marcelaAsrProvider: string;
  marcelaInputAudioFormat: string;
  marcelaBackgroundVoiceDetection: boolean;
  marcelaTurnEagerness: string;
  marcelaSpellingPatience: string;
  marcelaSpeculativeTurn: boolean;
  marcelaSilenceEndCallTimeout: number;
  marcelaMaxDuration: number;
  marcelaCascadeTimeout: number;
}

export interface TwilioStatus {
  connected: boolean;
  phoneNumber: string | null;
  error?: string;
}

export const TTS_MODEL_FAMILIES = [
  { value: "eleven_v3_conversational", label: "V3 Conversational", description: "Ultra-low latency, context-aware delivery, 70+ languages", badge: "Alpha" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5", description: "Fastest model, optimized for real-time streaming" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2", description: "High quality multilingual voice synthesis" },
] as const;

export const SUGGESTED_AUDIO_TAGS_OPTIONS = [
  "Patient", "Laughing", "US accent", "Sighs", "Concerned",
  "Excited", "Chuckles", "Coughs", "French accent", "Whispering",
  "Sad", "Angry", "Disappointed", "Enthusiastic", "Serious",
  "Singing", "Cheerful", "Nervous", "Hesitant", "Calm",
] as const;

export const OUTPUT_FORMATS = [
  { value: "pcm_16000", label: "PCM 16kHz", description: "16-bit PCM at 16kHz — optimal for real-time streaming" },
  { value: "pcm_22050", label: "PCM 22.05kHz", description: "16-bit PCM at 22.05kHz — higher quality" },
  { value: "pcm_24000", label: "PCM 24kHz", description: "16-bit PCM at 24kHz — studio quality" },
  { value: "pcm_44100", label: "PCM 44.1kHz", description: "16-bit PCM at 44.1kHz — CD quality" },
  { value: "mp3_44100_128", label: "MP3 128kbps", description: "Compressed audio, higher latency" },
  { value: "ulaw_8000", label: "u-law 8kHz", description: "Telephony standard" },
];

export const LLM_MODELS = [
  { value: "glm-45-air-fp8", label: "GLM-4.5-Air", description: "Great for agentic use cases", provider: "ElevenLabs" },
  { value: "qwen3-30b-a3b", label: "Qwen3-30B-A3B", description: "Ultra low latency", provider: "ElevenLabs" },
  { value: "qwen3-4b", label: "Qwen3-4B", description: "Ultra low latency, compact", provider: "ElevenLabs" },
  { value: "gpt-oss-120b", label: "GPT-OSS-120B", description: "Open-source model from OpenAI", provider: "ElevenLabs" },
  { value: "gpt-oss-20b", label: "GPT-OSS-20B", description: "Open-source model, compact", provider: "ElevenLabs" },
  { value: "watt-tool-70b", label: "Watt Tool 70B", description: "Tool-use optimized", provider: "ElevenLabs" },
  { value: "watt-tool-8b", label: "Watt Tool 8B", description: "Tool-use optimized, compact", provider: "ElevenLabs" },

  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", description: "Google's most capable model", provider: "Google" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", description: "Fast next-gen model", provider: "Google" },
  { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite Preview", description: "Fastest next-gen model", provider: "Google" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Fast thinking model", provider: "Google" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Lightweight and fast", provider: "Google" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Fast multimodal model", provider: "Google" },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", description: "Lightest 2.0 model", provider: "Google" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", description: "Long context, high quality", provider: "Google" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", description: "Efficient model", provider: "Google" },

  { value: "gpt-5", label: "GPT-5", description: "OpenAI's most capable model", provider: "OpenAI" },
  { value: "gpt-5.1", label: "GPT-5.1", description: "Improved GPT-5", provider: "OpenAI" },
  { value: "gpt-5.2", label: "GPT-5.2", description: "Latest GPT-5 series", provider: "OpenAI" },
  { value: "gpt-5-mini", label: "GPT-5 Mini", description: "Compact GPT-5", provider: "OpenAI" },
  { value: "gpt-5-nano", label: "GPT-5 Nano", description: "Fastest GPT-5", provider: "OpenAI" },
  { value: "gpt-4.1", label: "GPT-4.1", description: "Strong reasoning", provider: "OpenAI" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", description: "Faster, more economical", provider: "OpenAI" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano", description: "Fastest 4.1 model", provider: "OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", description: "Multimodal flagship", provider: "OpenAI" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "Compact but capable", provider: "OpenAI" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "Fast GPT-4", provider: "OpenAI" },

  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Latest Anthropic model", provider: "Anthropic" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", description: "Strong reasoning", provider: "Anthropic" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4", description: "Balanced performance", provider: "Anthropic" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", description: "Fast and efficient", provider: "Anthropic" },
  { value: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet", description: "Previous gen balanced", provider: "Anthropic" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", description: "Previous gen balanced", provider: "Anthropic" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku", description: "Previous gen fast", provider: "Anthropic" },

  { value: "grok-beta", label: "Grok Beta", description: "xAI's conversational model", provider: "xAI" },
  { value: "custom-llm", label: "Custom LLM", description: "Use your own LLM endpoint", provider: "Other" },
];

export const WIDGET_VARIANTS = [
  { value: "tiny", label: "Tiny", description: "Minimal interface" },
  { value: "compact", label: "Compact", description: "Standard interface" },
  { value: "full", label: "Full", description: "Expanded interface" },
] as const;

export const WIDGET_PLACEMENTS = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom", label: "Bottom Center" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
  { value: "top", label: "Top Center" },
] as const;
