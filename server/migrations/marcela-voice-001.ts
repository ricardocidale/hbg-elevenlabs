import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

const TAG = "marcela-voice-001";

/**
 * Adds newer marcela voice/conversation columns that may be missing from
 * production databases created before these fields were added to the schema.
 * All use ADD COLUMN IF NOT EXISTS and supply the same defaults as the schema.
 */
export async function runMarcelaVoice001(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE global_assumptions
        ADD COLUMN IF NOT EXISTS marcela_speed real NOT NULL DEFAULT 1.0,
        ADD COLUMN IF NOT EXISTS marcela_streaming_latency integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS marcela_text_normalisation text NOT NULL DEFAULT 'auto',
        ADD COLUMN IF NOT EXISTS marcela_asr_provider text NOT NULL DEFAULT 'scribe_realtime',
        ADD COLUMN IF NOT EXISTS marcela_input_audio_format text NOT NULL DEFAULT 'pcm_16000',
        ADD COLUMN IF NOT EXISTS marcela_background_voice_detection boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS marcela_turn_eagerness text NOT NULL DEFAULT 'auto',
        ADD COLUMN IF NOT EXISTS marcela_spelling_patience text NOT NULL DEFAULT 'auto',
        ADD COLUMN IF NOT EXISTS marcela_speculative_turn boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS marcela_silence_end_call_timeout integer NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS marcela_max_duration integer NOT NULL DEFAULT 600,
        ADD COLUMN IF NOT EXISTS marcela_cascade_timeout integer NOT NULL DEFAULT 5
    `);
    logger.info("Migration complete", TAG);
  } catch (error) {
    logger.error(`Migration failed: ${error}`, TAG);
  }
}
