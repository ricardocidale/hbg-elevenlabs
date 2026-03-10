/** Typed query key constants for the AI Agent feature module. */
export const AI_AGENT_KEYS = {
  voiceSettings:      ["admin", "voice-settings"]          as const,
  twilioStatus:       ["admin", "twilio-status"]           as const,
  convaiAgent:        ["admin", "convai-agent"]            as const,
  conversations:      ["admin", "convai-conversations"]    as const,
  conversation:       (id: string) => ["admin", "convai-conversation", id] as const,
  knowledgeBaseStatus:["admin", "knowledge-base-status"]   as const,
  knowledgeBaseSources:["admin", "knowledge-base-sources"] as const,
  signedUrl:          ["admin", "marcela-signed-url"]      as const,
} as const;
