import { type Express } from "express";
import { storage } from "../../storage";
import { requireAdmin, requireAuth } from "../../auth";
import { type InsertGlobalAssumptions } from "@shared/schema";
import { logAndSendError } from "../helpers";
import { getTwilioStatus, sendSMS } from "../../integrations/twilio";
import { getSignedUrl as getElevenLabsSignedUrl, getConvaiAgent, listConvaiConversations, getConvaiConversation, deleteConvaiConversation, updateConvaiAgent, createKBDocumentFromFile, getConversationAudio } from "../../integrations/elevenlabs";
import { configureMarcelaAgent, buildClientTools, buildServerTools, getBaseUrl } from "../../ai/marcela-agent-config";
import { uploadKnowledgeBase, getKnowledgeDocumentPreview, getKBSources } from "../../ai/marcela-knowledge-base";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export function registerMarcelaRoutes(app: Express) {
  app.get("/api/admin/knowledge-base/sources", requireAdmin, async (_req, res) => {
    try {
      const sources = await getKBSources();
      res.json({ sources });
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to fetch KB sources", error);
    }
  });

  app.post("/api/admin/convai/knowledge-base/rebuild", requireAdmin, async (req, res) => {
    try {
      const { sources } = req.body;
      const result = await uploadKnowledgeBase(sources);
      if (result.success) {
        res.json({ success: true, documentId: result.documentId, message: "Knowledge base rebuilt and uploaded successfully" });
      } else {
        res.status(500).json({ error: result.error || "Failed to rebuild knowledge base" });
      }
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to rebuild knowledge base", error);
    }
  });
  // All AI agent fields from global_assumptions — pick by prefix to avoid
  // manually listing 30+ fields (and missing new ones when schema grows).
  const AI_AGENT_FIELDS = [
    "aiAgentName", "showAiAssistant",
  ] as const;
  const MARCELA_PREFIX = "marcela";

  app.get("/api/admin/voice-settings", requireAdmin, async (_req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga) return res.status(404).json({ error: "No global assumptions found" });
      const result: Record<string, unknown> = {};
      for (const key of AI_AGENT_FIELDS) result[key] = (ga as any)[key];
      for (const key of Object.keys(ga)) {
        if (key.startsWith(MARCELA_PREFIX)) result[key] = (ga as any)[key];
      }
      res.json(result);
    } catch (error) {
      logAndSendError(res, "Failed to fetch voice settings", error);
    }
  });

  app.post("/api/admin/voice-settings", requireAdmin, async (req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga) return res.status(404).json({ error: "No global assumptions found" });
      const allowedFields = [
        "aiAgentName", "marcelaAgentId", "marcelaVoiceId", "marcelaTtsModel", "marcelaSttModel", "marcelaOutputFormat",
        "marcelaStability", "marcelaSimilarityBoost", "marcelaSpeakerBoost",
        "marcelaChunkSchedule", "marcelaLlmModel", "marcelaMaxTokens",
        "marcelaMaxTokensVoice", "marcelaEnabled", "showAiAssistant",
        "marcelaTwilioEnabled", "marcelaSmsEnabled", "marcelaPhoneGreeting", "marcelaLanguage",
        "marcelaTurnTimeout", "marcelaAvatarUrl", "marcelaWidgetVariant",
        "marcelaSpeed", "marcelaStreamingLatency", "marcelaTextNormalisation",
        "marcelaAsrProvider", "marcelaInputAudioFormat", "marcelaBackgroundVoiceDetection",
        "marcelaTurnEagerness", "marcelaSpellingPatience", "marcelaSpeculativeTurn",
        "marcelaSilenceEndCallTimeout", "marcelaMaxDuration", "marcelaCascadeTimeout",
      ] as const;
      const patch: Partial<Record<string, unknown>> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          patch[field] = req.body[field];
        }
      }
      const updated = await storage.upsertGlobalAssumptions(patch as InsertGlobalAssumptions);
      res.json(updated);
    } catch (error) {
      logAndSendError(res, "Failed to update voice settings", error);
    }
  });

  app.get("/api/admin/twilio-status", requireAdmin, async (_req, res) => {
    try {
      const status = await getTwilioStatus();
      res.json(status);
    } catch (error) {
      console.error("Error fetching Twilio status:", error);
      res.json({ connected: false, phoneNumber: null, error: "Failed to check Twilio status" });
    }
  });

  app.get("/api/admin/knowledge-base-status", requireAdmin, async (_req, res) => {
    try {
      const { getKnowledgeBaseStatus } = await import("../../ai/knowledge-base");
      res.json(getKnowledgeBaseStatus());
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to get knowledge base status", error);
    }
  });

  app.post("/api/admin/knowledge-base-reindex", requireAdmin, async (_req, res) => {
    try {
      const { indexKnowledgeBase } = await import("../../ai/knowledge-base");
      const result = await indexKnowledgeBase();
      res.json({ success: true, ...result });
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to reindex knowledge base", error);
    }
  });

  app.post("/api/marcela/scribe-token", requireAuth, async (_req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) return res.status(503).json({ error: "Service not configured" });
      const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
      });
      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text || "Failed to get scribe token" });
      }
      const data = await response.json();
      if (!data.token) return res.status(500).json({ error: "Invalid token response" });
      res.json({ token: data.token });
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to get scribe token", error);
    }
  });

  app.get("/api/marcela/signed-url", requireAuth, async (_req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) {
        return res.status(404).json({ error: "Agent ID not configured. Set the ElevenLabs Agent ID in Admin → AI Agent → General." });
      }
      const signedUrl = await getElevenLabsSignedUrl(ga.marcelaAgentId);
      res.json({ signedUrl });
    } catch (error: any) {
      const msg = error.message || "Failed to get signed URL";
      const isAuthError = msg.includes("not connected") || msg.includes("api_key") || msg.includes("401");
      if (isAuthError) {
        return res.status(503).json({ error: "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to your environment secrets." });
      }
      logAndSendError(res, msg, error);
    }
  });

  app.get("/api/admin/convai/health", requireAdmin, async (_req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      const agentId = ga?.marcelaAgentId || "";
      let apiKeySet = false;
      let signedUrlTest = "skipped";

      try {
        await getElevenLabsSignedUrl(agentId || "test");
        apiKeySet = true;
        signedUrlTest = agentId ? "ok" : "skipped — no agent ID";
      } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("not connected") || msg.includes("api_key")) {
          apiKeySet = false;
          signedUrlTest = "error — API key not set";
        } else if (!agentId) {
          apiKeySet = true;
          signedUrlTest = "error — no agent ID configured";
        } else {
          apiKeySet = true;
          signedUrlTest = `error — ${msg}`;
        }
      }

      res.json({ apiKeySet, agentId, signedUrlTest, showAiAssistant: !!(ga as any)?.showAiAssistant, marcelaEnabled: !!(ga as any)?.marcelaEnabled });
    } catch (error: any) {
      logAndSendError(res, error.message || "Health check failed", error);
    }
  });

  app.get("/api/admin/convai/agent", requireAdmin, async (_req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) {
        return res.status(404).json({ error: "Marcela agent not configured" });
      }
      const agent = await getConvaiAgent(ga.marcelaAgentId);
      res.json(agent);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to fetch agent config", error);
    }
  });

  app.get("/api/admin/convai/conversations", requireAdmin, async (_req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) {
        return res.status(404).json({ error: "Marcela agent not configured" });
      }
      const conversations = await listConvaiConversations(ga.marcelaAgentId);
      res.json({ conversations });
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to list conversations", error);
    }
  });

  app.get("/api/admin/convai/conversations/:id", requireAdmin, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const conversation = await getConvaiConversation(id);
      res.json(conversation);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to fetch conversation", error);
    }
  });

  app.post("/api/admin/convai/configure-tools", requireAdmin, async (_req, res) => {
    try {
      const result = await configureMarcelaAgent();
      if (result.success) {
        res.json({ success: true, message: "Agent tools configured successfully" });
      } else {
        res.status(500).json({ error: result.error || "Failed to configure agent tools" });
      }
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to configure agent tools", error);
    }
  });

  app.get("/api/admin/convai/knowledge-base/preview", requireAdmin, async (_req, res) => {
    try {
      const preview = await getKnowledgeDocumentPreview();
      res.json(preview);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to generate preview", error);
    }
  });

  // Download the full KB as a plain text file for manual upload to ElevenLabs
  app.get("/api/admin/convai/knowledge-base/download", requireAdmin, async (_req, res) => {
    try {
      const { buildKnowledgeDocument } = await import("../../ai/marcela-knowledge-base");
      const content = await buildKnowledgeDocument();
      const filename = `HBG-Knowledge-Base-${new Date().toISOString().split("T")[0]}.txt`;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to generate KB download", error);
    }
  });

  app.post("/api/admin/convai/knowledge-base/upload", requireAdmin, async (_req, res) => {
    try {
      const result = await uploadKnowledgeBase();
      if (result.success) {
        res.json({ success: true, documentId: result.documentId, message: "Knowledge base uploaded and attached to agent" });
      } else {
        res.status(500).json({ error: result.error || "Failed to upload knowledge base" });
      }
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to upload knowledge base", error);
    }
  });

  app.patch("/api/admin/convai/agent/prompt", requireAdmin, async (req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) {
        return res.status(404).json({ error: "Marcela agent not configured" });
      }
      const { prompt, first_message, language } = req.body;
      const updated = await updateConvaiAgent(ga.marcelaAgentId, {
        conversation_config: {
          agent: {
            prompt: { prompt },
            first_message,
            language,
          },
        },
      });
      // Persist language locally so the widget can read it without an admin API call
      if (language) {
        await storage.upsertGlobalAssumptions({ ...ga, marcelaLanguage: language } as any);
      }
      res.json(updated);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to update agent prompt", error);
    }
  });

  app.patch("/api/admin/convai/agent/widget-settings", requireAdmin, async (req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) return res.status(404).json({ error: "Marcela agent not configured" });

      const {
        turn_timeout, avatar_url, variant, placement, dismissible,
        default_expanded, avatar_orb_color_1, avatar_orb_color_2,
        text_input_enabled, mic_muting_enabled, transcript_enabled,
        conversation_mode_toggle_enabled, language_selector,
        feedback_mode, bg_color, text_color, btn_color, btn_text_color,
        border_color, focus_color,
      } = req.body;

      const patch: Record<string, unknown> = {};

      // Turn timeout goes to conversation_config
      if (turn_timeout !== undefined) {
        patch.conversation_config = { turn: { turn_timeout: Number(turn_timeout) } };
      }

      // Build widget patch — all settings pushed to ElevenLabs widget config
      const widgetPatch: Record<string, unknown> = {};

      // Avatar: image URL takes priority; otherwise orb with custom colors
      if (avatar_url !== undefined) {
        widgetPatch.avatar = avatar_url
          ? { type: "image", url: avatar_url }
          : { type: "orb", color_1: avatar_orb_color_1 || "#2792dc", color_2: avatar_orb_color_2 || "#9ce6e6" };
      } else if (avatar_orb_color_1 !== undefined || avatar_orb_color_2 !== undefined) {
        widgetPatch.avatar = {
          type: "orb",
          color_1: avatar_orb_color_1 || "#2792dc",
          color_2: avatar_orb_color_2 || "#9ce6e6",
        };
      }

      // Layout
      if (variant !== undefined) widgetPatch.variant = variant;
      if (placement !== undefined) widgetPatch.placement = placement;
      if (dismissible !== undefined) widgetPatch.dismissible = dismissible;
      if (default_expanded !== undefined) widgetPatch.default_expanded = default_expanded;

      // Features
      if (text_input_enabled !== undefined) widgetPatch.text_input_enabled = text_input_enabled;
      if (mic_muting_enabled !== undefined) widgetPatch.mic_muting_enabled = mic_muting_enabled;
      if (transcript_enabled !== undefined) widgetPatch.transcript_enabled = transcript_enabled;
      if (conversation_mode_toggle_enabled !== undefined) widgetPatch.conversation_mode_toggle_enabled = conversation_mode_toggle_enabled;
      if (language_selector !== undefined) widgetPatch.language_selector = language_selector;

      // Feedback
      if (feedback_mode !== undefined) {
        widgetPatch.feedback_mode = feedback_mode;
        if (feedback_mode === "end") {
          widgetPatch.end_feedback = { type: "rating" };
        }
      }

      // Colors
      if (bg_color !== undefined) widgetPatch.bg_color = bg_color;
      if (text_color !== undefined) widgetPatch.text_color = text_color;
      if (btn_color !== undefined) widgetPatch.btn_color = btn_color;
      if (btn_text_color !== undefined) widgetPatch.btn_text_color = btn_text_color;
      if (border_color !== undefined) widgetPatch.border_color = border_color;
      if (focus_color !== undefined) widgetPatch.focus_color = focus_color;

      if (Object.keys(widgetPatch).length) {
        patch.platform_settings = { ...(patch.platform_settings as Record<string, unknown> || {}), widget: widgetPatch };
      }

      const updated = await updateConvaiAgent(ga.marcelaAgentId, patch);

      // Persist locally (subset that we also store in our DB)
      const dbPatch: Partial<Record<string, unknown>> = {};
      if (turn_timeout !== undefined) dbPatch.marcelaTurnTimeout = Number(turn_timeout);
      if (avatar_url !== undefined) dbPatch.marcelaAvatarUrl = avatar_url;
      if (variant !== undefined) dbPatch.marcelaWidgetVariant = variant;
      if (Object.keys(dbPatch).length) await storage.upsertGlobalAssumptions(dbPatch as any);

      res.json(updated);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to update widget settings", error);
    }
  });

  app.get("/api/admin/convai/tools-status", requireAdmin, async (_req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) {
        return res.status(404).json({ error: "Marcela agent not configured" });
      }
      const agent = await getConvaiAgent(ga.marcelaAgentId);
      const registeredTools = (agent.conversation_config?.agent?.prompt as any)?.tools || [];
      
      const baseUrl = getBaseUrl();
      const clientTools = buildClientTools();
      const serverTools = buildServerTools(baseUrl);
      const allExpectedTools = [...clientTools, ...serverTools];

      const status = allExpectedTools.map(expected => {
        const registered = registeredTools.find((t: any) => t.name === expected.name);
        return {
          name: expected.name,
          type: expected.type,
          description: expected.description,
          registered: !!registered,
        };
      });

      res.json(status);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to fetch tools status", error);
    }
  });

  app.post("/api/admin/convai/knowledge-base/upload-file", requireAdmin, upload.single("file"), async (req: any, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) {
        return res.status(404).json({ error: "Marcela agent not configured" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const doc = await createKBDocumentFromFile(req.file.originalname, req.file.buffer, req.file.originalname);
      
      // Attach to agent
      const agent = await getConvaiAgent(ga.marcelaAgentId);
      const existingKB = (agent.conversation_config?.agent?.prompt as any)?.knowledge_base || [];
      
      await updateConvaiAgent(ga.marcelaAgentId, {
        conversation_config: {
          agent: {
            prompt: {
              knowledge_base: [
                ...existingKB,
                { type: "file", id: doc.id, name: doc.name },
              ],
            },
          },
        },
      });

      res.json({ success: true, documentId: doc.id, name: doc.name });
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to upload KB file", error);
    }
  });

  app.delete("/api/admin/convai/conversations/:id", requireAdmin, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await deleteConvaiConversation(id);
      res.json({ success: true });
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to delete conversation", error);
    }
  });

  app.patch("/api/admin/convai/agent/llm", requireAdmin, async (req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) return res.status(404).json({ error: "Marcela agent not configured" });
      const { llm, max_tokens } = req.body;
      const promptPatch: Record<string, unknown> = {};
      if (llm !== undefined) promptPatch.llm = llm;
      if (max_tokens !== undefined) promptPatch.max_tokens = max_tokens;
      const updated = await updateConvaiAgent(ga.marcelaAgentId, {
        conversation_config: { agent: { prompt: promptPatch } },
      });
      const dbPatch: Partial<Record<string, unknown>> = {};
      if (llm !== undefined) dbPatch.marcelaLlmModel = llm;
      if (max_tokens !== undefined) dbPatch.marcelaMaxTokens = max_tokens;
      if (Object.keys(dbPatch).length) await storage.upsertGlobalAssumptions(dbPatch as any);
      res.json(updated);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to update LLM settings", error);
    }
  });

  app.patch("/api/admin/convai/agent/voice", requireAdmin, async (req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) return res.status(404).json({ error: "Marcela agent not configured" });
      const {
        voice_id, stability, similarity_boost, use_speaker_boost, speed,
        agent_output_audio_format, optimize_streaming_latency, text_normalisation_type,
        model_id, expressive_mode, suggested_audio_tags,
        asr_provider, user_input_audio_format, background_voice_detection,
        turn_eagerness, spelling_patience, speculative_turn,
        turn_timeout, silence_end_call_timeout,
        max_duration_seconds, cascade_timeout_seconds,
      } = req.body;

      const ttsPatch: Record<string, unknown> = {};
      if (voice_id !== undefined) ttsPatch.voice_id = voice_id;
      if (stability !== undefined) ttsPatch.stability = stability;
      if (similarity_boost !== undefined) ttsPatch.similarity_boost = similarity_boost;
      if (speed !== undefined) ttsPatch.speed = speed;
      if (agent_output_audio_format !== undefined) ttsPatch.agent_output_audio_format = agent_output_audio_format;
      if (optimize_streaming_latency !== undefined) ttsPatch.optimize_streaming_latency = optimize_streaming_latency;
      if (text_normalisation_type !== undefined) ttsPatch.text_normalisation_type = text_normalisation_type;
      if (model_id !== undefined) ttsPatch.model_id = model_id;
      if (expressive_mode !== undefined) ttsPatch.expressive_mode = expressive_mode;
      if (suggested_audio_tags !== undefined) ttsPatch.suggested_audio_tags = suggested_audio_tags;

      const asrPatch: Record<string, unknown> = {};
      if (asr_provider !== undefined) asrPatch.provider = asr_provider;
      if (user_input_audio_format !== undefined) asrPatch.user_input_audio_format = user_input_audio_format;

      const vadPatch: Record<string, unknown> = {};
      if (background_voice_detection !== undefined) vadPatch.background_voice_detection = background_voice_detection;

      const turnPatch: Record<string, unknown> = {};
      if (turn_eagerness !== undefined) turnPatch.turn_eagerness = turn_eagerness;
      if (spelling_patience !== undefined) turnPatch.spelling_patience = spelling_patience;
      if (speculative_turn !== undefined) turnPatch.speculative_turn = speculative_turn;
      if (turn_timeout !== undefined) turnPatch.turn_timeout = turn_timeout;
      if (silence_end_call_timeout !== undefined) turnPatch.silence_end_call_timeout = silence_end_call_timeout;

      const convPatch: Record<string, unknown> = {};
      if (max_duration_seconds !== undefined) convPatch.max_duration_seconds = max_duration_seconds;

      const promptPatch: Record<string, unknown> = {};
      if (cascade_timeout_seconds !== undefined) promptPatch.cascade_timeout_seconds = cascade_timeout_seconds;

      const convaiPatch: Record<string, unknown> = {};
      if (Object.keys(ttsPatch).length) convaiPatch.tts = ttsPatch;
      if (Object.keys(asrPatch).length) convaiPatch.asr = asrPatch;
      if (Object.keys(vadPatch).length) convaiPatch.vad = vadPatch;
      if (Object.keys(turnPatch).length) convaiPatch.turn = turnPatch;
      if (Object.keys(convPatch).length) convaiPatch.conversation = convPatch;
      if (Object.keys(promptPatch).length) convaiPatch.agent = { prompt: promptPatch };

      const updated = Object.keys(convaiPatch).length
        ? await updateConvaiAgent(ga.marcelaAgentId, { conversation_config: convaiPatch })
        : {};

      const dbPatch: Partial<Record<string, unknown>> = {};
      if (voice_id !== undefined) dbPatch.marcelaVoiceId = voice_id;
      if (stability !== undefined) dbPatch.marcelaStability = stability;
      if (similarity_boost !== undefined) dbPatch.marcelaSimilarityBoost = similarity_boost;
      if (use_speaker_boost !== undefined) dbPatch.marcelaSpeakerBoost = use_speaker_boost;
      if (speed !== undefined) dbPatch.marcelaSpeed = speed;
      if (agent_output_audio_format !== undefined) dbPatch.marcelaOutputFormat = agent_output_audio_format;
      if (optimize_streaming_latency !== undefined) dbPatch.marcelaStreamingLatency = optimize_streaming_latency;
      if (text_normalisation_type !== undefined) dbPatch.marcelaTextNormalisation = text_normalisation_type;
      if (model_id !== undefined) dbPatch.marcelaTtsModel = model_id;
      if (asr_provider !== undefined) dbPatch.marcelaAsrProvider = asr_provider;
      if (user_input_audio_format !== undefined) dbPatch.marcelaInputAudioFormat = user_input_audio_format;
      if (background_voice_detection !== undefined) dbPatch.marcelaBackgroundVoiceDetection = background_voice_detection;
      if (turn_eagerness !== undefined) dbPatch.marcelaTurnEagerness = turn_eagerness;
      if (spelling_patience !== undefined) dbPatch.marcelaSpellingPatience = spelling_patience;
      if (speculative_turn !== undefined) dbPatch.marcelaSpeculativeTurn = speculative_turn;
      if (turn_timeout !== undefined) dbPatch.marcelaTurnTimeout = turn_timeout;
      if (silence_end_call_timeout !== undefined) dbPatch.marcelaSilenceEndCallTimeout = silence_end_call_timeout;
      if (max_duration_seconds !== undefined) dbPatch.marcelaMaxDuration = max_duration_seconds;
      if (cascade_timeout_seconds !== undefined) dbPatch.marcelaCascadeTimeout = cascade_timeout_seconds;
      if (Object.keys(dbPatch).length) await storage.upsertGlobalAssumptions(dbPatch as any);
      res.json(updated);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to update voice settings", error);
    }
  });

  app.get("/api/admin/convai/conversations/:id/audio", requireAdmin, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { buffer, contentType } = await getConversationAudio(id);
      res.set("Content-Type", contentType);
      res.set("Content-Length", buffer.length.toString());
      res.send(buffer);
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to fetch conversation audio", error);
    }
  });

  app.delete("/api/admin/convai/agent/knowledge-base/:docId", requireAdmin, async (req, res) => {
    try {
      const ga = await storage.getGlobalAssumptions();
      if (!ga?.marcelaAgentId) return res.status(404).json({ error: "Marcela agent not configured" });
      const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;
      const agent = await getConvaiAgent(ga.marcelaAgentId);
      const kb: any[] = (agent.conversation_config?.agent as any)?.knowledge_base
        ?? (agent.conversation_config?.agent?.prompt as any)?.knowledge_base ?? [];
      const updatedKb = kb.filter((doc: any) => doc.id !== docId);
      const useTopLevel = !!((agent.conversation_config?.agent as any)?.knowledge_base);
      await updateConvaiAgent(ga.marcelaAgentId, useTopLevel
        ? { conversation_config: { agent: { knowledge_base: updatedKb } } }
        : { conversation_config: { agent: { prompt: { knowledge_base: updatedKb } } } }
      );
      res.json({ success: true });
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to remove KB document", error);
    }
  });

  app.post("/api/admin/send-notification", requireAdmin, async (req, res) => {
    try {
      const { to, message } = req.body;
      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }
      const result = await sendSMS(to, message);
      if (result.success) {
        res.json({ success: true, sid: result.sid });
      } else {
        res.status(500).json({ error: result.error || "Failed to send SMS" });
      }
    } catch (error: any) {
      logAndSendError(res, error.message || "Failed to send notification", error);
    }
  });
}
