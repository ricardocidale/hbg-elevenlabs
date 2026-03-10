import { ElevenLabsClient } from 'elevenlabs';
import WebSocket from 'ws';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (xReplitToken && hostname) {
    try {
      connectionSettings = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=elevenlabs',
        {
          headers: {
            'Accept': 'application/json',
            'X-Replit-Token': xReplitToken
          }
        }
      ).then(res => res.json()).then(data => data.items?.[0]);

      if (connectionSettings?.settings?.api_key) {
        return connectionSettings.settings.api_key;
      }
    } catch {
    }
  }

  if (process.env.ELEVENLABS_API_KEY) {
    return process.env.ELEVENLABS_API_KEY;
  }

  throw new Error('ElevenLabs not connected');
}

export async function getUncachableElevenLabsClient() {
  const apiKey = await getCredentials();
  return new ElevenLabsClient({ apiKey });
}

export async function getElevenLabsApiKey() {
  return await getCredentials();
}

export const MARCELA_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';

export interface VoiceConfig {
  voiceId: string;
  ttsModel: string;
  sttModel: string;
  outputFormat: string;
  stability: number;
  similarityBoost: number;
  speakerBoost: boolean;
  chunkSchedule: number[];
}

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: MARCELA_VOICE_ID,
  ttsModel: 'eleven_flash_v2_5',
  sttModel: 'scribe_v1',
  outputFormat: 'pcm_16000',
  stability: 0.5,
  similarityBoost: 0.8,
  speakerBoost: false,
  chunkSchedule: [120, 160, 250, 290],
};

export function buildVoiceConfigFromDB(ga: Record<string, unknown>): VoiceConfig {
  const chunkStr = (ga.marcelaChunkSchedule as string) || '120,160,250,290';
  return {
    voiceId: (ga.marcelaVoiceId as string) || DEFAULT_VOICE_CONFIG.voiceId,
    ttsModel: (ga.marcelaTtsModel as string) || DEFAULT_VOICE_CONFIG.ttsModel,
    sttModel: (ga.marcelaSttModel as string) || DEFAULT_VOICE_CONFIG.sttModel,
    outputFormat: (ga.marcelaOutputFormat as string) || DEFAULT_VOICE_CONFIG.outputFormat,
    stability: (ga.marcelaStability as number) ?? DEFAULT_VOICE_CONFIG.stability,
    similarityBoost: (ga.marcelaSimilarityBoost as number) ?? DEFAULT_VOICE_CONFIG.similarityBoost,
    speakerBoost: (ga.marcelaSpeakerBoost as boolean) ?? DEFAULT_VOICE_CONFIG.speakerBoost,
    chunkSchedule: chunkStr.split(',').map(Number).filter(n => !isNaN(n)),
  };
}

export async function createElevenLabsStreamingTTS(
  voiceId: string,
  onAudioChunk: (audioBase64: string) => void,
  options: { modelId?: string; outputFormat?: string; stability?: number; similarityBoost?: number; speakerBoost?: boolean; chunkSchedule?: number[] } = {}
) {
  const {
    modelId = DEFAULT_VOICE_CONFIG.ttsModel,
    outputFormat = DEFAULT_VOICE_CONFIG.outputFormat,
    stability = DEFAULT_VOICE_CONFIG.stability,
    similarityBoost = DEFAULT_VOICE_CONFIG.similarityBoost,
    speakerBoost = DEFAULT_VOICE_CONFIG.speakerBoost,
    chunkSchedule = DEFAULT_VOICE_CONFIG.chunkSchedule,
  } = options;
  const apiKey = await getCredentials();
  const uri = 'wss://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream-input?model_id=' + modelId + '&output_format=' + outputFormat;

  const websocket = new WebSocket(uri, {
    headers: { 'xi-api-key': apiKey },
  });

  return new Promise<{
    send: (text: string) => void;
    flush: () => void;
    close: () => void;
  }>((resolve, reject) => {
    websocket.on('error', reject);

    websocket.on('open', () => {
      websocket.send(JSON.stringify({
        text: ' ',
        voice_settings: { stability, similarity_boost: similarityBoost, use_speaker_boost: speakerBoost },
        generation_config: { chunk_length_schedule: chunkSchedule },
      }));

      resolve({
        send: (text: string) => {
          websocket.send(JSON.stringify({ text }));
        },
        flush: () => {
          websocket.send(JSON.stringify({ text: ' ', flush: true }));
        },
        close: () => {
          websocket.send(JSON.stringify({ text: '' }));
        },
      });
    });

    websocket.on('message', (event) => {
      const data = JSON.parse(event.toString());
      if (data.audio) {
        onAudioChunk(data.audio);
      }
    });
  });
}

export interface ConvaiAgent {
  agent_id: string;
  name: string;
  conversation_config?: {
    agent?: { prompt?: { prompt?: string }; first_message?: string; language?: string };
    tts?: {
      voice_id?: string;
      model_id?: string;
      expressive_mode?: boolean;
      suggested_audio_tags?: string[];
    };
    conversation?: { text_only?: boolean };
  };
}

export interface ConvaiConversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  transcript?: Array<{ role: 'user' | 'agent'; message: string; time_in_call_secs?: number }>;
  metadata?: Record<string, unknown>;
}

export interface ConvaiConversationListItem {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time_unix_secs?: number;
  call_duration_secs?: number;
}

const CONVAI_BASE = 'https://api.elevenlabs.io/v1/convai';

async function convaiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const apiKey = await getCredentials();
  const { method = 'GET', body } = options;
  const headers: Record<string, string> = { 'xi-api-key': apiKey };
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${CONVAI_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs Convai API error (${response.status}): ${text}`);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export async function getConvaiAgent(agentId: string): Promise<ConvaiAgent> {
  return convaiRequest<ConvaiAgent>(`/agents/${agentId}`);
}

export async function updateConvaiAgent(agentId: string, config: Record<string, unknown>): Promise<ConvaiAgent> {
  return convaiRequest<ConvaiAgent>(`/agents/${agentId}`, {
    method: 'PATCH',
    body: config,
  });
}

export async function listConvaiConversations(agentId: string): Promise<ConvaiConversationListItem[]> {
  const result = await convaiRequest<{ conversations: ConvaiConversationListItem[] }>(
    `/conversations?agent_id=${agentId}`
  );
  return result.conversations || [];
}

export async function getConvaiConversation(conversationId: string): Promise<ConvaiConversation> {
  return convaiRequest<ConvaiConversation>(`/conversations/${conversationId}`);
}

export async function deleteConvaiConversation(conversationId: string): Promise<void> {
  await convaiRequest<void>(`/conversations/${conversationId}`, { method: 'DELETE' });
}

export async function getSignedUrl(agentId: string): Promise<string> {
  const apiKey = await getCredentials();
  const response = await fetch(
    `${CONVAI_BASE}/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey } }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs signed URL error (${response.status}): ${text}`);
  }
  const data = await response.json() as { signed_url: string };
  return data.signed_url;
}

export interface KBDocument {
  id: string;
  name: string;
}

export async function createKBDocumentFromText(name: string, text: string): Promise<KBDocument> {
  return convaiRequest<KBDocument>('/knowledge-base/text', {
    method: 'POST',
    body: { name, text },
  });
}

export async function getKBDocument(docId: string): Promise<KBDocument & { status?: string }> {
  return convaiRequest<KBDocument & { status?: string }>(`/knowledge-base/${docId}`);
}

export async function deleteKBDocument(docId: string): Promise<void> {
  await convaiRequest<void>(`/knowledge-base/${docId}`, { method: 'DELETE' });
}

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain', '.md': 'text/markdown', '.html': 'text/html',
  '.pdf': 'application/pdf', '.epub': 'application/epub+zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function createKBDocumentFromFile(name: string, fileBuffer: Buffer, fileName: string): Promise<KBDocument> {
  const apiKey = await getCredentials();
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
  formData.append('name', name);

  const response = await fetch(`${CONVAI_BASE}/knowledge-base/file`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs KB Upload error (${response.status}): ${text}`);
  }

  return response.json() as Promise<KBDocument>;
}

export async function getConversationAudio(conversationId: string): Promise<{ buffer: Buffer; contentType: string }> {
  const apiKey = await getCredentials();
  const response = await fetch(`${CONVAI_BASE}/conversations/${conversationId}/audio`, {
    headers: { 'xi-api-key': apiKey },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs audio error (${response.status}): ${text}`);
  }
  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string, sttModel?: string): Promise<string> {
  const apiKey = await getCredentials();

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), filename);
  formData.append('model_id', sttModel || DEFAULT_VOICE_CONFIG.sttModel);

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Transcription failed: ' + response.statusText);
  }

  const result = await response.json() as { text: string };
  return result.text;
}
