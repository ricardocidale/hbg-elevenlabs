import { describe, it, expect } from "vitest";
import { buildVoiceConfigFromDB, MARCELA_VOICE_ID, type VoiceConfig } from "../../server/integrations/elevenlabs";

describe("Voice Config (buildVoiceConfigFromDB)", () => {
  it("returns defaults when all fields are empty", () => {
    const config = buildVoiceConfigFromDB({});
    expect(config.voiceId).toBe(MARCELA_VOICE_ID);
    expect(config.ttsModel).toBe("eleven_flash_v2_5");
    expect(config.sttModel).toBe("scribe_v1");
    expect(config.outputFormat).toBe("pcm_16000");
    expect(config.stability).toBe(0.5);
    expect(config.similarityBoost).toBe(0.8);
    expect(config.speakerBoost).toBe(false);
    expect(config.chunkSchedule).toEqual([120, 160, 250, 290]);
  });

  it("uses DB values when provided", () => {
    const config = buildVoiceConfigFromDB({
      marcelaVoiceId: "custom-voice-id",
      marcelaTtsModel: "eleven_turbo_v2",
      marcelaSttModel: "whisper_v3",
      marcelaOutputFormat: "pcm_24000",
      marcelaStability: 0.7,
      marcelaSimilarityBoost: 0.9,
      marcelaSpeakerBoost: true,
      marcelaChunkSchedule: "100,200,300",
    });
    expect(config.voiceId).toBe("custom-voice-id");
    expect(config.ttsModel).toBe("eleven_turbo_v2");
    expect(config.sttModel).toBe("whisper_v3");
    expect(config.outputFormat).toBe("pcm_24000");
    expect(config.stability).toBe(0.7);
    expect(config.similarityBoost).toBe(0.9);
    expect(config.speakerBoost).toBe(true);
    expect(config.chunkSchedule).toEqual([100, 200, 300]);
  });

  it("handles partial overrides (mixed DB and defaults)", () => {
    const config = buildVoiceConfigFromDB({
      marcelaVoiceId: "my-voice",
      marcelaStability: 0.3,
    });
    expect(config.voiceId).toBe("my-voice");
    expect(config.stability).toBe(0.3);
    // Rest should be defaults
    expect(config.ttsModel).toBe("eleven_flash_v2_5");
    expect(config.sttModel).toBe("scribe_v1");
    expect(config.similarityBoost).toBe(0.8);
  });

  it("uses nullish coalescing for numeric 0 values", () => {
    const config = buildVoiceConfigFromDB({
      marcelaStability: 0,
      marcelaSimilarityBoost: 0,
    });
    // 0 is a valid value and should NOT fall back to default
    expect(config.stability).toBe(0);
    expect(config.similarityBoost).toBe(0);
  });

  it("parses chunk schedule from comma-separated string", () => {
    const config = buildVoiceConfigFromDB({
      marcelaChunkSchedule: "50,100,150,200,250",
    });
    expect(config.chunkSchedule).toEqual([50, 100, 150, 200, 250]);
  });

  it("filters NaN values from chunk schedule", () => {
    const config = buildVoiceConfigFromDB({
      marcelaChunkSchedule: "120,abc,200,,300",
    });
    // Empty string parses to 0 via Number(""), "abc" is NaN and filtered
    // But Number("") === 0 which is not NaN, so it passes the filter
    expect(config.chunkSchedule).toEqual([120, 200, 0, 300]);
  });

  it("returns VoiceConfig shape with all required fields", () => {
    const config = buildVoiceConfigFromDB({});
    const keys: (keyof VoiceConfig)[] = [
      "voiceId", "ttsModel", "sttModel", "outputFormat",
      "stability", "similarityBoost", "speakerBoost", "chunkSchedule",
    ];
    for (const key of keys) {
      expect(config).toHaveProperty(key);
    }
  });
});
