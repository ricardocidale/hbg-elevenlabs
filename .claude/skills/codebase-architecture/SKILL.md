---
name: codebase-architecture
description: Client-side codebase organization, barrel files, re-export wrappers, helper functions, utility scripts, and module boundaries. Use when restructuring code, adding new modules, or auditing imports.
---

# Codebase Architecture

## Client Folder Structure

```
client/src/
├── components/          # Shared app-level components
│   ├── ui/              # shadcn/ui primitives (Button, Card, Input, Dialog, etc.)
│   ├── admin/           # Admin panel tabs and sub-components
│   ├── dashboard/       # Dashboard tabs (KPIs, charts, export)
│   ├── financial-table/ # Financial statement table components
│   ├── graphics/        # Visual components (motion, cards, 3D)
│   ├── property-detail/ # Property detail sub-views
│   ├── property-edit/   # Property edit form sections
│   ├── property-research/ # Research display components
│   ├── property-finder/ # Property search/finder UI
│   ├── statements/      # Financial statement components
│   ├── settings/        # User settings tabs
│   └── *.tsx            # Top-level shared components (Layout, Breadcrumbs, etc.)
├── features/            # Self-contained feature modules
│   ├── ai-agent/        # Marcela AI (ElevenLabs, voice, chat)
│   └── design-themes/   # Theme management (ThemeManager, ThemePreview)
├── hooks/               # Shared React hooks
├── lib/                 # Utilities, API clients, engine
│   ├── api/             # API client modules (properties, admin, research, etc.)
│   ├── audits/          # Client-side audit/validation utilities
│   ├── exports/         # Export generators (PDF, Excel, PNG, CSV, PPTX)
│   └── financial/       # Financial engine (calculators, types, utils)
└── pages/               # Route-level page components
```

## Module Boundaries

### Rule: features/ = self-contained, components/ = shared
- `features/` modules own their hooks, types, components, and API calls
- `components/` contains shared UI used across multiple pages
- `components/ui/` contains shadcn primitives + custom app components (see catalog below)

### Rule: Import direction
- Pages import from features, components, hooks, and lib
- Features may import from lib and components/ui, NOT from other features
- Components may import from lib and components/ui
- lib has no UI imports

## UI Component Catalog (`components/ui/`)

### shadcn Primitives (standard — do not modify except via shadcn CLI)
`Accordion`, `AlertDialog`, `Alert`, `AspectRatio`, `Avatar`, `Badge`, `Breadcrumb`, `Button`, `Calendar`, `Card`, `Carousel`, `Chart`, `Checkbox`, `Collapsible`, `Command`, `ContextMenu`, `Dialog`, `Drawer`, `DropdownMenu`, `Form`, `HoverCard`, `Input`, `InputOTP`, `Label`, `Menubar`, `NavigationMenu`, `Pagination`, `Popover`, `Progress`, `RadioGroup`, `Resizable`, `ScrollArea`, `Select`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`, `Slider`, `Sonner`, `Switch`, `Table`, `Tabs` (CAUTION: has custom `CurrentThemeTab` at bottom — never overwrite), `Textarea`, `Toast`, `Toaster`, `Toggle`, `ToggleGroup`, `Tooltip`

### Tooltips (4 types)
| Component | Icon | Import | Use For |
|-----------|------|--------|---------|
| `Tooltip` + `TooltipTrigger` + `TooltipContent` | Custom | `@/components/ui/tooltip` | Base Radix primitive — use when you need a fully custom trigger element |
| `HelpTooltip` | `?` (HelpCircle) | `@/components/ui/help-tooltip` | Financial table line items — internal transparency feature. Props: `text`, `light?`, `side?`, `manualSection?`, `manualLabel?` |
| `InfoTooltip` | `i` (Info) | `@/components/ui/info-tooltip` | Form input fields — concept definitions. Props: `text`, `formula?` (renders monospace code block), `light?`, `side?`, `manualSection?`, `manualLabel?` |
| `ChartTooltip` + `ChartTooltipContent` | None (hover) | `@/components/ui/chart` | Recharts data-point hover tooltips inside charts. Used by all chart components in `lib/charts/`. Props: `cursor?`, `content` (pass `<ChartTooltipContent hideLabel? indicator? nameKey? />`) |

**Chart Tooltip usage** — Every chart in `lib/charts/` uses `ChartTooltip` + `ChartTooltipContent` from the shadcn chart system. These show formatted values when hovering over data points, bars, or slices. The `FinancialChart` component (`components/ui/financial-chart.tsx`) also uses the Recharts `Tooltip` directly with a `tooltipFormatter` prop for custom value formatting (defaults to `formatMoney`).

### Buttons & Actions
| Component | Import | Description |
|-----------|--------|-------------|
| `SaveButton` | `@/components/ui/save-button` | Standard save button with loading state. Props: `onClick`, `disabled`, `isPending`, `label?` |
| `ButtonGroup` | `@/components/ui/button-group` | Group related buttons with `ButtonGroupText` for labels |
| `ExportMenu` | `@/components/ui/export-toolbar` | Dropdown menu with export actions. Use with `pdfAction()`, `csvAction()`, `excelAction()`, `pptxAction()`, `pngAction()` helpers |

### Cards & Containers
| Component | Import | Description |
|-----------|--------|-------------|
| `StatCard` | `@/components/ui/stat-card` | KPI card with label, value, trend. Props: `title`, `value`, `format?` ("money"/"percent"/"number"/"text"), `trend?`, `icon?` |
| `SectionCard` | `@/components/ui/section-card` | Titled card section with optional actions. Props: `title`, `description?`, `children`, `actions?` |
| `EntityCardContainer` | `@/components/ui/entity-card` | Card for entity lists (properties, companies). Handles click, selection, actions |
| `ContentPanel` | `@/components/ui/content-panel` | Full-width content container with consistent padding |
| `PageHeader` | `@/components/ui/page-header` | Page title bar with optional back link and action buttons. Props: `title`, `subtitle?`, `backLink?`, `actions?` |
| `Callout` | `@/components/ui/callout` | Alert box with severity. Props: `severity` ("warning"/"critical"/"info"/"success"), `variant` ("dark"/"light"), `title?`, `children` |
| `Empty` | `@/components/ui/empty` | Empty state placeholder with `EmptyHeader`, `EmptyMedia`, composable sub-components |

### Form Components
| Component | Import | Description |
|-----------|--------|-------------|
| `FieldSet` / `FieldGroup` / `FieldLegend` | `@/components/ui/field` | Semantic form grouping with consistent spacing |
| `InputGroup` | `@/components/ui/input-group` | Input with prefix/suffix addons (e.g., "$" prefix, "%" suffix) |
| `NativeSelect` | `@/components/ui/native-select` | Native `<select>` element (use when shadcn Select is overkill) |
| `EditableValue` | `@/components/ui/editable-value` | Inline-editable numeric value. Props: `value`, `onChange`, `format` ("percent"/"dollar"/"months"/"number") |
| `ColorPicker` | `@/components/ui/color-picker` | Color swatch picker with preset colors + custom hex input. Props: `value`, `onChange` |
| `ImageCropDialog` | `@/components/ui/image-crop-dialog` | Dialog for cropping uploaded images before saving |
| `AIImagePicker` | `@/components/ui/ai-image-picker` | Multi-mode image input: upload, AI generate, or paste URL. Props: `onSelect`, `aspectRatio?` |

### Badges & Status
| Component | Import | Description |
|-----------|--------|-------------|
| `StatusBadge` | `@/components/ui/status-badge` | Dot + label badge. Props: `status` ("active"/"inactive"/"pending"/"error"/"warning"), `label?` |
| `GaapBadge` | `@/components/ui/gaap-badge` | GAAP compliance rule badge. Props: `rule`, `className?` |
| `ResearchBadge` | `@/components/ui/research-badge` | Data source badge. Props: `source` ("market"/"industry"/"ai"/"seed"), `entries?` |

### Financial & Data
| Component | Import | Description |
|-----------|--------|-------------|
| `FinancialChart` | `@/components/ui/financial-chart` | Multi-series line/bar chart. Props: `data`, `series` (string[] or ChartSeries[]), `title?` |
| `FinancialTable` | `@/components/ui/financial-table` | Generic financial data table. Props: `columns` (FinancialTableColumn[]), `rows` (FinancialTableRow[]) |
| `ManualTable` | `@/components/ui/manual-table` | Simple table for documentation/manuals. Props: `headers`, `rows`, `variant?` ("dark"/"light") |

### Media & Visual
| Component | Import | Description |
|-----------|--------|-------------|
| `ImagePreviewCard` | `@/components/ui/image-preview-card` | Image thumbnail with aspect ratio options. Props: `src`, `alt`, `aspect?` |
| `AnimatedLogo` | `@/components/ui/animated-logo` | Logo with animation modes. Props: `src`, `mode` ("none"/"pulse"/"glow"/"spin"/"bounce"), `size?` |
| `UserAvatar` | `@/components/ui/user-avatar` | User avatar with initials fallback. Props: `name`, `avatarUrl?`, `size?` ("sm"/"md"/"lg") |
| `Spinner` | `@/components/ui/spinner` | Loading spinner SVG |

### Animation
| Component | Import | Description |
|-----------|--------|-------------|
| `FadeIn`, `FadeInUp`, `ScaleIn`, `SlideIn` | `@/components/ui/animated` | Framer-motion wrapper components. Props: `delay?`, `duration?`, `className?` |
| `StaggerContainer`, `AnimatedCounter`, `HoverScale` | `@/components/ui/animated` | Container stagger, number counter animation, hover scale effect |

### Special Effects (Magic UI) — full reference: `.claude/skills/ui/magic-ui.md`
| Component | Import | Description |
|-----------|--------|-------------|
| `Particles` | `@/components/ui/particles` | Mouse-interactive canvas particle background |
| `NumberTicker` | `@/components/ui/number-ticker` | Spring-physics counting number — preferred over `AnimatedCounter` for new financial displays |
| `BlurFade` | `@/components/ui/blur-fade` | Blur-in reveal on mount or scroll entry |
| `ShimmerButton` | `@/components/ui/shimmer-button` | Light-sweep shimmer CTA button |
| `AnimatedGradientText` | `@/components/ui/animated-gradient-text` | Animated gradient-shift text |
| `Ripple` | `@/components/ui/ripple` | Concentric expanding ring animation |
| `AuroraText` | `@/components/ui/aurora-text` | Aurora color-shift display heading |
| `AnimatedBeam` | `@/components/ui/animated-beam` | SVG animated beam connecting two refs |
| `Meteors` | `@/components/ui/meteors` | CSS falling-streak card background |

### Utility
| Component | Import | Description |
|-----------|--------|-------------|
| `Kbd` / `KbdGroup` | `@/components/ui/kbd` | Keyboard shortcut display (`⌘K` style) |
| `DirectionProvider` / `useDirection` | `@/components/ui/direction` | LTR/RTL context provider |
| `TypographyH1`–`H4`, `TypographyP`, `TypographyLead`, `TypographyLarge` | `@/components/ui/typography` | Semantic typography components with consistent styles |

## Barrel Files (index.ts)

Barrel files aggregate exports from a directory into a single import path.

| Directory | Barrel | Exports |
|-----------|--------|---------|
| `components/admin/` | `index.ts` | All admin tab components |
| `components/dashboard/` | `index.ts` | Dashboard tabs and hooks |
| `components/financial-table/` | `index.ts` | Row components, table shell |
| `components/property-detail/` | `index.ts` | Detail sub-components |
| `components/property-edit/` | `index.ts` | Edit form sections |
| `components/property-research/` | `index.ts` | Research sub-components |
| `components/property-finder/` | `index.ts` | Finder sub-components |
| `components/settings/` | `index.ts` | Settings tab components |
| `features/ai-agent/` | `index.ts` | ElevenLabsWidget, VoiceChat*, Speaker, Transcriber |
| `features/ai-agent/components/` | `index.ts` | 16+ AI agent UI components |
| `features/ai-agent/hooks/` | `index.ts` | AI agent hooks + query keys |
| `lib/api/` | `index.ts` | API client modules |
| `lib/financial/` | `index.ts` | Financial engine (types, utils, calculators) |
| `lib/exports/` | `index.ts` | Export utilities |
| `lib/exports/excel/` | `index.ts` | Excel-specific exports |

## Thin Re-export Wrappers

These files re-export from a canonical source to provide backward-compatible or convenience import paths. They contain zero logic — pure `export` statements only.

| Wrapper | Source of Truth | Purpose |
|---------|----------------|---------|
| `components/admin/MarcelaTab.tsx` | `./marcela/MarcelaTab` | Barrel convenience |
| `components/admin/marcela/hooks.ts` | `@/features/ai-agent/hooks` | Bridge admin→feature |
| `components/admin/marcela/types.ts` | `features/ai-agent/types` | Bridge admin→feature |
| `components/financial-table-rows.tsx` | `./financial-table/index` | Legacy path |
| `components/ConsolidatedBalanceSheet.tsx` | `./statements/ConsolidatedBalanceSheet` | Legacy path |
| `lib/api.ts` | `./api/index` | Shorthand `@/lib/api` |
| `lib/financialEngine.ts` | `./financial` | Shorthand `@/lib/financialEngine` |
| `lib/exports/excelExport.ts` | `./excel/index` | Legacy path |
| `pages/CheckerManual.tsx` | `./checker-manual/index` | Router entry |

### Wrapper Rules
1. Wrappers must be pure re-exports — no logic, no side effects
2. New code should import from the canonical source, not wrappers
3. Never create new wrappers — use barrel files instead
4. Orphan wrappers (zero importers) should be deleted during cleanup

## ElevenLabs / AI Agent Architecture ("Marcela")

### NPM Packages
| Package | Version | Purpose |
|---------|---------|---------|
| `elevenlabs` | ^1.56.1 | Server-side SDK — TTS, STT, Convai API |
| `@elevenlabs/react` | ^0.14.1 | Client React hooks — `useConversation` (WebRTC voice sessions) |
| `@elevenlabs/convai-widget-core` | ^0.10.0 | Native `<elevenlabs-convai>` web component core |
| `@elevenlabs/elevenlabs-js` | ^2.38.1 | Client JS SDK — voice types, `Scribe` realtime transcription |

### Type Declarations
`client/src/elevenlabs-convai.d.ts` — JSX intrinsic element types for `<elevenlabs-convai>` web component (agent-id, signed-url, variant, avatar, dynamic-variables, etc.)

### Feature Module: `features/ai-agent/`

Self-contained feature module. DO NOT touch `Speaker.tsx` or modify ElevenLabs internal files except for error boundaries.

```
features/ai-agent/
├── index.ts                     # Barrel: ElevenLabsWidget, VoiceChatOrb/Full/Bar, Speaker, RealtimeTranscriber01
├── types.ts                     # VoiceSettings, TwilioStatus, TTS_MODELS, STT_MODELS, OUTPUT_FORMATS, LLM_MODELS
├── query-keys.ts                # AI_AGENT_KEYS for TanStack Query
├── ElevenLabsWidget.tsx         # Main floating widget — lazy-loads variant (Orb/Bars/Matrix/ConversationBar)
├── VoiceChatOrb.tsx             # Voice-only orb interface using @elevenlabs/react useConversation
├── VoiceChatFull.tsx            # Full chat + voice hybrid using @elevenlabs/react useConversation
├── VoiceChatBar.tsx             # Compact bar chat interface
├── Speaker.tsx                  # Standalone TTS audio player (DO NOT MODIFY)
├── RealtimeTranscriber.tsx      # Live speech-to-text using @elevenlabs/client Scribe
├── RealtimeTranscriberLanguageSelector.tsx  # Language dropdown for Scribe
├── components/                  # 18 sub-components (see below)
│   ├── index.ts                 # Barrel (AgentState collision note: orb exported separately)
│   ├── orb.tsx                  # 3D WebGL orb + CSSFallbackOrb + WebGLBoundary error boundary
│   ├── bar-visualizer.tsx       # Audio volume bars, useAudioVolume hook
│   ├── matrix.tsx               # LED matrix visualizer (default/vu modes)
│   ├── conversation-bar.tsx     # ConversationBar — main voice+text widget using @elevenlabs/react
│   ├── conversation.tsx         # Conversation, ConversationContent, ConversationEmptyState containers
│   ├── waveform.tsx             # Waveform, ScrollingWaveform, AudioScrubber (Canvas, NOT WebGL)
│   ├── live-waveform.tsx        # LiveWaveform for realtime audio (Canvas, NOT WebGL)
│   ├── audio-player.tsx         # AudioPlayer context + useAudioPlayer hook
│   ├── voice-button.tsx         # VoiceButton with states (idle/connecting/connected/error)
│   ├── voice-picker.tsx         # Voice selection dropdown (ElevenLabs voice library)
│   ├── mic-selector.tsx         # MicSelector + useAudioDevices hook
│   ├── speech-input.tsx         # Speech input bar with recording state
│   ├── scrub-bar.tsx            # Audio scrub/seek bar
│   ├── shimmering-text.tsx      # Animated text effect for agent responses
│   ├── message.tsx              # Message bubble (user/agent variants)
│   ├── response.tsx             # Streaming response renderer (uses Streamdown)
│   └── transcript-viewer.tsx    # Transcript display with word-level alignment
└── hooks/
    ├── index.ts                 # Barrel + AI_AGENT_KEYS re-export
    ├── use-agent-settings.ts    # useMarcelaSettings — fetch/update voice settings
    ├── use-convai-api.ts        # useConvaiAgent — fetch Convai agent config
    ├── use-conversations.ts     # useConvaiConversations — list/fetch/delete conversations
    ├── use-knowledge-base.ts    # useKnowledgeBase — KB document management
    └── use-signed-url.ts        # useSignedUrl — fetch signed URL for WebRTC sessions
```

### Related Client Hooks (outside feature module)
| Hook | Path | Purpose |
|------|------|---------|
| `use-scribe.ts` | `hooks/` | ElevenLabs `@elevenlabs/client` Scribe realtime connection, exports AudioFormat, CommitStrategy, RealtimeEvents |
| `use-transcript-viewer.ts` | `hooks/` | Transcript playback with CharacterAlignmentResponseModel |

### Widget Variants (configured via Admin > AI Agent > Voice tab)
| Variant Key | Component | Visual |
|-------------|-----------|--------|
| `compact` | `ConversationBar` | Text + voice bar (default) |
| `orb` | `Orb` + `ConversationBar` | 3D/CSS animated orb + expandable bar |
| `bars` | `BarVisualizer` + `ConversationBar` | Audio level bars + expandable bar |
| `matrix` | `Matrix` + `ConversationBar` | LED grid + expandable bar |
| `full` | Standalone page only | Full chat + voice (VoiceLab page) |
| `tiny` | Native `<elevenlabs-convai>` | ElevenLabs default widget |
| `voice-bar` | `VoiceChatBar` | Custom SDK voice bar |

### VoiceLab Page (`pages/VoiceLab.tsx`)
Showcase page exposing all voice interface variants in tabs: Voice Orb, Full Chat, Bar, Realtime Transcriber, and Speaker demo.

### Server-Side Architecture

#### `server/integrations/elevenlabs.ts` — Core ElevenLabs Client
| Export | Description |
|--------|-------------|
| `getUncachableElevenLabsClient()` | Create `ElevenLabsClient` with Replit connector credentials |
| `getElevenLabsApiKey()` | Get raw API key for direct REST calls |
| `MARCELA_VOICE_ID` | Default voice: `cgSgspJ2msm6clMCkdW9` |
| `buildVoiceConfigFromDB(ga)` | Build VoiceConfig from globalAssumptions DB row |
| `createElevenLabsStreamingTTS(voiceId, onAudioChunk, opts)` | WebSocket streaming TTS (used by Twilio phone) |
| `getConvaiAgent(agentId)` | GET Convai agent config |
| `updateConvaiAgent(agentId, config)` | PATCH Convai agent (prompt, tools, voice, LLM) |
| `listConvaiConversations(agentId)` | List agent conversations |
| `getConvaiConversation(id)` / `deleteConvaiConversation(id)` | Single conversation CRUD |
| `getSignedUrl(agentId)` | Get signed URL for client WebRTC sessions |
| `createKBDocumentFromText(name, text)` / `createKBDocumentFromFile(name, buf, filename)` | Upload knowledge base docs |
| `getKBDocument(id)` / `deleteKBDocument(id)` | KB document CRUD |
| `getConversationAudio(id)` | Download conversation audio recording |
| `transcribeAudio(buffer, filename, sttModel?)` | STT transcription |

#### `server/integrations/elevenlabs-audio.ts` — Telephony Audio Utilities
| Export | Description |
|--------|-------------|
| `mulaw2linear(byte)` / `linear2mulaw(sample)` | μ-law ↔ PCM conversion |
| `mulawBufferToWav(mulawData)` | Convert μ-law buffer to WAV |
| `pcm16ToMulaw(pcmBase64)` | Convert PCM16 base64 to μ-law |
| `downsample(pcmBase64, fromRate, toRate)` | Audio resampling |
| `escapeXml(str)` | XML-safe string escaping (for TwiML) |
| `buildSystemPrompt(channel, isAdmin)` | Build Marcela system prompt for phone/SMS |

#### `server/ai/marcela-agent-config.ts` — Convai Agent Configuration
| Export | Description |
|--------|-------------|
| `getBaseUrl()` | Resolve app URL (REPLIT_DEV_DOMAIN → REPL_SLUG → localhost) |
| `buildClientTools()` | 12 client-side tools (navigateToPage, showPropertyDetails, openPropertyEditor, showPortfolio, showAnalysis, showDashboard, startGuidedTour, openHelp, showScenarios, openPropertyFinder, showCompanyPage, getCurrentContext) |
| `buildServerTools(baseUrl)` | 6 webhook tools (getProperties, getPropertyDetails, getPortfolioSummary, getScenarios, getGlobalAssumptions, getNavigation) |
| `configureMarcelaAgent()` | Register all 18 tools + LLM model on the Convai agent |

#### `server/ai/marcela-knowledge-base.ts` — Knowledge Base Builder
| Export | Description |
|--------|-------------|
| `uploadKnowledgeBase()` | Build KB document from live data → upload to Convai → attach to agent |
| `getKnowledgeDocumentPreview()` | Preview KB document (sections, chars, text) |

#### `server/ai/knowledge-base.ts` — RAG Engine (OpenAI embeddings)
| Export | Description |
|--------|-------------|
| `splitIntoChunks(text, title, source, category)` | Text chunking (800 chars, 100 overlap) |
| `indexKnowledgeBase()` | Build embedding index from local knowledge files |
| `retrieveRelevantChunks(query, topK?)` | Semantic search (top-8, cosine similarity) |
| `buildRAGContext(chunks)` | Format retrieved chunks for LLM context (max 4000 chars) |
| `getKnowledgeBaseStatus()` | Index status (indexed, chunkCount, indexedAt) |

#### `server/routes/twilio.ts` — Twilio Phone + SMS Integration
Handles inbound phone calls and SMS via Twilio. Uses `createElevenLabsStreamingTTS` for real-time voice over WebSocket, `transcribeAudio` for STT, and OpenAI for LLM reasoning. Audio conversion via `elevenlabs-audio.ts` (μ-law ↔ PCM for telephony codec).

#### `server/routes/admin/marcela.ts` — Admin API Routes (22 endpoints)
All admin routes require `requireAdmin` middleware. Key endpoints:
| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/voice-settings` | GET/POST | Read/update all Marcela DB settings |
| `/api/admin/twilio-status` | GET | Twilio connection status |
| `/api/admin/knowledge-base-status` | GET | RAG index status |
| `/api/admin/knowledge-base-reindex` | POST | Re-index RAG embeddings |
| `/api/marcela/signed-url` | GET | Get signed URL (requireAuth, not admin) |
| `/api/marcela/scribe-token` | POST | Get single-use Scribe token |
| `/api/admin/convai/agent` | GET | Fetch Convai agent config |
| `/api/admin/convai/agent/prompt` | PATCH | Update prompt, first_message, language |
| `/api/admin/convai/agent/voice` | PATCH | Update voice_id, model_id, stability |
| `/api/admin/convai/agent/llm` | PATCH | Update LLM model + max_tokens |
| `/api/admin/convai/agent/widget-settings` | PATCH | Update turn_timeout, avatar, variant |
| `/api/admin/convai/configure-tools` | POST | Register all 18 tools on agent |
| `/api/admin/convai/tools-status` | GET | Check which tools are registered |
| `/api/admin/convai/conversations` | GET | List conversations |
| `/api/admin/convai/conversations/:id` | GET/DELETE | Single conversation |
| `/api/admin/convai/conversations/:id/audio` | GET | Download conversation audio |
| `/api/admin/convai/knowledge-base/preview` | GET | Preview KB document |
| `/api/admin/convai/knowledge-base/upload` | POST | Upload auto-generated KB |
| `/api/admin/convai/knowledge-base/upload-file` | POST | Upload custom file to KB |
| `/api/admin/convai/agent/knowledge-base/:docId` | DELETE | Remove KB document |
| `/api/admin/send-notification` | POST | Send SMS via Twilio |

### Admin Panel Tabs (`components/admin/marcela/`)
| File | Tab | Controls |
|------|-----|----------|
| `MarcelaTab.tsx` | Container | Sub-tab router (Voice, Prompt, LLM, KB, Conversations, Tools, Telephony) |
| `VoiceSettings.tsx` | Voice | Voice ID, TTS model, stability, similarity, chunk schedule, widget variant selector (7 variants) |
| `PromptEditor.tsx` | Prompt | System prompt, first message, language |
| `LLMSettings.tsx` | LLM | Model selector (11 models: Gemini, GPT-4, Claude, ElevenLabs), max tokens |
| `KnowledgeBase.tsx` | Knowledge | Upload KB, preview, attach/detach documents |
| `ConversationHistory.tsx` | History | List, view transcripts, play audio, delete conversations |
| `ToolsStatus.tsx` | Tools | View registered tools status, re-configure tools |
| `TelephonySettings.tsx` | Telephony | Twilio status, phone/SMS toggle, phone greeting, send test SMS |
| `hooks.ts` | — | Re-export wrapper → `@/features/ai-agent/hooks` |
| `types.ts` | — | Re-export wrapper → `features/ai-agent/types` |

### Connection Flow
1. **Web (Convai):** Admin configures agent → `signed-url` endpoint → client `useConversation` (WebRTC) → ElevenLabs cloud handles voice/LLM → client/server tools execute locally
2. **Phone (Twilio):** Inbound call → TwiML WebSocket → `transcribeAudio` (STT) → OpenAI (LLM) → `createElevenLabsStreamingTTS` (WebSocket TTS) → μ-law audio back to Twilio
3. **SMS (Twilio):** Inbound SMS → OpenAI (LLM with RAG context) → `sendSMS` response

### ElevenLabs Models Reference
**TTS:** eleven_flash_v2_5 (lowest latency), eleven_flash_v2, eleven_multilingual_v2 (29 languages), eleven_turbo_v2_5, eleven_turbo_v2, eleven_monolingual_v1
**STT:** scribe_v1
**Output Formats:** pcm_16000 (default), pcm_22050, pcm_24000, pcm_44100, mp3_44100_128, ulaw_8000 (telephony)
**LLM:** gemini-2.5-flash, gemini-2.0-flash-001, gemini-1.5-flash, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini, claude-3-5-sonnet, claude-3-haiku, custom-llm/elevenlabs

## Animation Modules

Two complementary animation modules exist:

| Module | Path | Components | Used By |
|--------|------|------------|---------|
| Motion primitives | `components/ui/animated.tsx` | FadeIn, FadeInUp, ScaleIn, SlideIn, StaggerContainer, AnimatedCounter, HoverScale, etc. (12 exports) | 4 files (cards, portfolio) |
| Page transitions | `components/graphics/motion/AnimatedPage.tsx` | AnimatedPage, AnimatedSection, AnimatedGrid, ScrollReveal (5 exports) | 25+ pages |

These are complementary, NOT duplicates. Do not consolidate without checking all consumers.

## Helper Functions & Utilities

### lib/themeUtils.ts — Theme Engine
- `hexToHslString(hex)` — Convert hex to CSS HSL string
- `applyThemeColors(colors)` — Inject DesignColor[] as :root CSS variables
- `resetThemeColors()` — Remove all dynamic theme variables

### lib/financial/ — Financial Engine
Core calculation engine. Never use LLM to compute financial values.
- `financialEngine.ts` → re-exports from `./financial/` (convenience)
- Calculators: loan, cash flow, returns, depreciation, tax
- Types: all financial interfaces

### lib/exports/ — Export Generators
- `pdfChartDrawer.ts` — Draw charts in jsPDF documents
- `pptxExport.ts` — PowerPoint generation
- `pngExport.ts` — PNG table captures via dom-to-image
- `csvExport.ts` — CSV downloads
- `excel/` — Multi-sheet Excel workbooks

### lib/api/ — API Client
- `properties.ts`, `admin.ts`, `research.ts`, `scenarios.ts`, `services.ts`
- `types.ts` — shared API response interfaces

### lib/audits/ — Client-side Validation
- `crossCalculatorValidation.ts` — cross-check financial calculators
- `formulaChecker.ts` — verify formula correctness
- `helpers.ts` — shared audit utilities

## Scripts (`script/`)

| Script | Command | Purpose |
|--------|---------|---------|
| `health.ts` | `npm run health` | tsc + tests + verification |
| `stats.ts` | `npm run stats` | Codebase metrics |
| `audit-quick.ts` | `npm run audit:quick` | Quality scan |
| `test-summary.ts` | `npm run test:summary` | Compact test output |
| `test-file.ts` | `npm run test:file -- <path>` | Single file test |
| `lint-summary.ts` | `npm run lint:summary` | tsc --noEmit check |
| `diff-summary.ts` | `npm run diff:summary` | Git diff stats |
| `build.ts` | `npm run build` | Production build |
| `exports-check.ts` | `npm run exports:check` | Find unused exports |
| `seed-preset-themes.ts` | `npx tsx script/seed-preset-themes.ts` | Seed 5 preset themes |
| `seed-lb-brand-theme.ts` | `npx tsx script/seed-lb-brand-theme.ts` | Seed L+B Brand theme |
| `seed-production.sql` | Manual | Production data sync |
| `manual-sync/` | Manual | 00-06 SQL sync scripts |
| `admin-structure.ts` | Manual | Analyze admin page |
| `marcela-check.ts` | Manual | Check Marcela AI endpoints |
| `marcela-conversations.ts` | Manual | Manage Marcela conversations |
| `create-boutique-logos.ts` | Manual | Seed boutique hotel logos |
| `list-tables.ts` | Manual | List DB tables |

## Cleanup Checklist

When auditing the codebase:
1. Run `npm run exports:check` — find unused exports
2. Search for orphan wrappers: re-export files with zero importers
3. Check `components/` for feature-specific code that should be in `features/`
4. Verify all barrel files export everything from their directory
5. Confirm no `console.log` in production code (except AI agent debug logs)
