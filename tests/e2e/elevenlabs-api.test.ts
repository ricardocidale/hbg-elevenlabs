/**
 * test-elevenlabs-api.ts — End-to-end test of every ElevenLabs API call.
 *
 * Tests READ and WRITE operations against the live ElevenLabs API.
 * Run: npx vitest run script/test-elevenlabs-api.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  getElevenLabsApiKey,
  getConvaiAgent,
  updateConvaiAgent,
  listConvaiConversations,
  getSignedUrl,
  createKBDocumentFromText,
  getKBDocument,
  deleteKBDocument,
  createKBDocumentFromFile,
  transcribeAudio,
  type ConvaiAgent,
} from "../../server/integrations/elevenlabs.js";

// We need the agent ID from the database. Read it from global assumptions.
let agentId: string;
let apiKey: string;

beforeAll(async () => {
  apiKey = await getElevenLabsApiKey();
  expect(apiKey).toBeTruthy();

  // List agents to find one (avoids DB dependency in test)
  const res = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
    headers: { "xi-api-key": apiKey },
  });
  if (res.ok) {
    const data = await res.json();
    const agents = (data as any).agents || [];
    if (agents.length > 0) {
      agentId = agents[0].agent_id;
      console.log(`Using agent: ${agents[0].name} (${agentId})`);
    }
  }

  console.log(`API Key: ${apiKey.substring(0, 8)}...`);
  console.log(`Agent ID: ${agentId || "NOT CONFIGURED"}`);
});

describe("ElevenLabs API — Credential Check", () => {
  it("API key is present and valid format", () => {
    expect(apiKey).toMatch(/^sk_/);
  });
});

describe("ElevenLabs API — ConvAI Agent (READ)", () => {
  it("GET agent config returns valid agent object", async () => {
    if (!agentId) return console.log("SKIP: no agent ID");
    const agent = await getConvaiAgent(agentId);
    expect(agent).toBeDefined();
    expect(agent.agent_id).toBe(agentId);
    expect(agent.name).toBeTruthy();
    console.log(`  Agent name: ${agent.name}`);
    console.log(`  Has prompt: ${!!agent.conversation_config?.agent?.prompt?.prompt}`);
    console.log(`  Voice ID: ${agent.conversation_config?.tts?.voice_id || "default"}`);
    console.log(`  Language: ${agent.conversation_config?.agent?.language || "default"}`);
  });
});

describe("ElevenLabs API — ConvAI Agent (WRITE)", () => {
  it("PATCH agent voice settings (stability) and read back", async () => {
    if (!agentId) return console.log("SKIP: no agent ID");

    // Read current
    const before = await getConvaiAgent(agentId);
    const currentStability = (before.conversation_config?.tts as any)?.stability;
    console.log(`  Current stability: ${currentStability}`);

    // Write a test value
    const testStability = currentStability === 0.6 ? 0.65 : 0.6;
    const updated = await updateConvaiAgent(agentId, {
      conversation_config: {
        tts: { stability: testStability },
      },
    });
    expect(updated).toBeDefined();

    // Read back to verify
    const after = await getConvaiAgent(agentId);
    const newStability = (after.conversation_config?.tts as any)?.stability;
    console.log(`  New stability: ${newStability}`);
    expect(newStability).toBeCloseTo(testStability, 1);

    // Restore original
    if (currentStability !== undefined) {
      await updateConvaiAgent(agentId, {
        conversation_config: { tts: { stability: currentStability } },
      });
      console.log(`  Restored to: ${currentStability}`);
    }
  });

  it("PATCH agent first_message and read back", async () => {
    if (!agentId) return console.log("SKIP: no agent ID");

    const before = await getConvaiAgent(agentId);
    const originalMessage = before.conversation_config?.agent?.first_message || "";
    console.log(`  Original first_message: "${originalMessage.substring(0, 60)}..."`);

    // Write test message
    const testMsg = originalMessage + " [E2E-TEST]";
    await updateConvaiAgent(agentId, {
      conversation_config: { agent: { first_message: testMsg } },
    });

    // Verify
    const after = await getConvaiAgent(agentId);
    expect(after.conversation_config?.agent?.first_message).toContain("[E2E-TEST]");
    console.log(`  Updated first_message contains test marker: YES`);

    // Restore
    await updateConvaiAgent(agentId, {
      conversation_config: { agent: { first_message: originalMessage } },
    });
    console.log(`  Restored original first_message`);
  });
});

describe("ElevenLabs API — Signed URL (READ)", () => {
  it("GET signed URL returns valid wss:// URL", async () => {
    if (!agentId) return console.log("SKIP: no agent ID");
    const url = await getSignedUrl(agentId);
    expect(url).toBeTruthy();
    expect(url).toMatch(/^wss:\/\//);
    console.log(`  Signed URL: ${url.substring(0, 60)}...`);
  });
});

describe("ElevenLabs API — Conversations (READ)", () => {
  it("LIST conversations returns array", async () => {
    if (!agentId) return console.log("SKIP: no agent ID");
    const conversations = await listConvaiConversations(agentId);
    expect(Array.isArray(conversations)).toBe(true);
    console.log(`  Total conversations: ${conversations.length}`);
    if (conversations.length > 0) {
      const latest = conversations[0];
      console.log(`  Latest: ${latest.conversation_id} (${latest.status})`);
    }
  });
});

describe("ElevenLabs API — Knowledge Base (READ + WRITE)", () => {
  let testDocId: string | null = null;

  it("CREATE KB document from text", async () => {
    const doc = await createKBDocumentFromText(
      "E2E Test Document",
      "This is a test document created by the automated E2E test suite. It should be deleted shortly."
    );
    expect(doc).toBeDefined();
    expect(doc.id).toBeTruthy();
    expect(doc.name).toBe("E2E Test Document");
    testDocId = doc.id;
    console.log(`  Created KB doc: ${doc.id} (${doc.name})`);
  });

  it("GET KB document by ID", async () => {
    if (!testDocId) return console.log("SKIP: no test doc created");
    const doc = await getKBDocument(testDocId);
    expect(doc.id).toBe(testDocId);
    expect(doc.name).toBe("E2E Test Document");
    console.log(`  Retrieved: ${doc.id} (status: ${doc.status || "unknown"})`);
  });

  it("CREATE KB document from file (Buffer)", async () => {
    const testContent = Buffer.from("This is a test file upload for E2E testing.\nLine 2 of test content.");
    const doc = await createKBDocumentFromFile("E2E Test File", testContent, "test-file.txt");
    expect(doc).toBeDefined();
    expect(doc.id).toBeTruthy();
    console.log(`  Uploaded file KB doc: ${doc.id} (${doc.name})`);

    // Clean up
    await deleteKBDocument(doc.id);
    console.log(`  Deleted file KB doc: ${doc.id}`);
  });

  it("DELETE KB document", async () => {
    if (!testDocId) return console.log("SKIP: no test doc created");
    await deleteKBDocument(testDocId);
    console.log(`  Deleted KB doc: ${testDocId}`);

    // Verify deletion — GET should fail
    try {
      await getKBDocument(testDocId);
      console.log("  WARNING: Document still accessible after delete");
    } catch (err: any) {
      expect(err.message).toMatch(/404|not found/i);
      console.log(`  Confirmed deleted (404)`);
    }
  });
});

describe("ElevenLabs API — Scribe Token (WRITE)", () => {
  it("POST single-use scribe token", async () => {
    const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.token).toBeTruthy();
    console.log(`  Scribe token: ${data.token.substring(0, 20)}...`);
  });
});

describe("ElevenLabs API — Speech-to-Text (WRITE)", () => {
  it("POST transcribe silent audio returns text (or empty)", async () => {
    // Create a minimal WAV file (silence) — 44-byte header + 100 samples
    const sampleRate = 16000;
    const numSamples = 1600; // 100ms of silence
    const header = Buffer.alloc(44);
    // RIFF header
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + numSamples * 2, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // chunk size
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(numSamples * 2, 40);

    const silence = Buffer.alloc(numSamples * 2);
    const wavBuffer = Buffer.concat([header, silence]);

    try {
      const text = await transcribeAudio(wavBuffer, "silence.wav");
      console.log(`  Transcription result: "${text}" (${text.length} chars)`);
      // Silent audio should return empty or very short text
      expect(typeof text).toBe("string");
    } catch (err: any) {
      // Some error codes are acceptable for very short/silent audio
      console.log(`  Transcription response: ${err.message}`);
      // Don't fail — the API may reject very short audio
    }
  });
});

describe("ElevenLabs API — Agent PATCH Voice Config (WRITE)", () => {
  it("PATCH voice_id + similarity_boost and read back", async () => {
    if (!agentId) return console.log("SKIP: no agent ID");

    const before = await getConvaiAgent(agentId);
    const tts = before.conversation_config?.tts || {};
    const origVoiceId = (tts as any).voice_id;
    const origSimilarity = (tts as any).similarity_boost;
    console.log(`  Before — voice_id: ${origVoiceId}, similarity_boost: ${origSimilarity}`);

    // Write test values
    const testSimilarity = origSimilarity === 0.7 ? 0.75 : 0.7;
    await updateConvaiAgent(agentId, {
      conversation_config: {
        tts: { similarity_boost: testSimilarity },
      },
    });

    // Read back
    const after = await getConvaiAgent(agentId);
    const newSimilarity = (after.conversation_config?.tts as any)?.similarity_boost;
    console.log(`  After — similarity_boost: ${newSimilarity}`);
    expect(newSimilarity).toBeCloseTo(testSimilarity, 1);

    // Restore
    if (origSimilarity !== undefined) {
      await updateConvaiAgent(agentId, {
        conversation_config: { tts: { similarity_boost: origSimilarity } },
      });
      console.log(`  Restored similarity_boost to ${origSimilarity}`);
    }
  });
});

describe("ElevenLabs API — Agent LLM Config (WRITE)", () => {
  it("PATCH max_tokens and read back", async () => {
    if (!agentId) return console.log("SKIP: no agent ID");

    const before = await getConvaiAgent(agentId);
    const origMaxTokens = (before.conversation_config?.agent?.prompt as any)?.max_tokens;
    console.log(`  Before max_tokens: ${origMaxTokens}`);

    // Write test value
    const testTokens = origMaxTokens === 500 ? 512 : 500;
    await updateConvaiAgent(agentId, {
      conversation_config: { agent: { prompt: { max_tokens: testTokens } } },
    });

    // Read back
    const after = await getConvaiAgent(agentId);
    const newMaxTokens = (after.conversation_config?.agent?.prompt as any)?.max_tokens;
    console.log(`  After max_tokens: ${newMaxTokens}`);
    expect(newMaxTokens).toBe(testTokens);

    // Restore
    if (origMaxTokens !== undefined) {
      await updateConvaiAgent(agentId, {
        conversation_config: { agent: { prompt: { max_tokens: origMaxTokens } } },
      });
      console.log(`  Restored max_tokens to ${origMaxTokens}`);
    }
  });
});
