# HBG ElevenLabs Integration

Complete ElevenLabs Conversational AI (ConvAI) integration for the Hospitality Business Group platform. Powers "Marcela", the AI assistant accessible via web widget, voice orb, and full-screen chat.

## Features

- **ConvAI Agent** — Real-time voice conversation with ElevenLabs agent
- **Voice Chat Orb** — 3D animated orb with frequency-reactive visuals (Three.js)
- **Full-Screen Chat** — Expanded voice interface with transcript
- **Speaker** — Audio player with demo tracks, 3D orbs, ambience processing
- **Scribe (STT)** — Real-time speech-to-text transcription via WebSocket
- **Knowledge Base** — Automated KB management from markdown sources
- **Waveform** — Canvas-based audio visualizer for mic and playback
- **Admin UI** — Voice settings, LLM config, KB management

## Architecture

```
client/src/features/ai-agent/     # All AI agent components & hooks
client/src/components/admin/marcela/  # Admin config panels
client/src/hooks/use-scribe.ts     # Scribe WebSocket hook
client/replit_integrations/audio/  # Audio streaming utilities
server/integrations/elevenlabs.ts  # Core ElevenLabs client
server/ai/                         # Agent config, KB builder
server/routes/admin/marcela.ts     # Admin API routes
server/ai/kb/                      # Knowledge base source documents
```

## Dependencies

- `@11labs/react` — ElevenLabs React SDK
- `@11labs/client` — ElevenLabs client SDK
- `three` / `@react-three/fiber` / `@react-three/drei` — 3D orb visuals
- `framer-motion` — Animations
- `openai` — LLM for agent responses

## Setup

1. Set ElevenLabs API key in environment
2. Configure agent ID and voice ID in admin panel
3. Build knowledge base from KB source documents
4. Enable ConvAI widget or voice orb in the app
