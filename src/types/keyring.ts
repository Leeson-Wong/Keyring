// Shared type definitions for Keyring
// Used by both frontend and backend

export interface KeyEntry {
  id: string;           // UUID
  platform: string;     // openai, elevenlabs, silicon-flow, replicate...
  function: string;     // llm, tts, stt, embedding, image-gen, video, search...
  endpoint: string;     // API base URL
  models: string[];     // associated model names
  apiKey: string;       // the key itself
  name: string;         // display name / alias
  tags: string[];       // free-form tags
  notes: string;        // free text notes
  status: 'active' | 'revoked' | 'expired';
  // Computed / audit
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
  revokedAt?: string;   // ISO timestamp, set when revoked
  versions: KeyVersion[];
}

/** Snapshot of a key before modification */
export interface KeyVersion {
  version: number;
  timestamp: string;
  snapshot: Omit<KeyEntry, 'versions'>;
  changeNote?: string;
}

/** Input for creating a new key */
export interface CreateKeyInput {
  platform: string;
  function: string;
  endpoint?: string;
  models?: string[];
  apiKey: string;
  name?: string;
  tags?: string[];
  notes?: string;
}

/** Input for updating an existing key */
export interface UpdateKeyInput {
  platform?: string;
  function?: string;
  endpoint?: string;
  models?: string[];
  apiKey?: string;
  name?: string;
  tags?: string[];
  notes?: string;
  status?: 'active' | 'expired';
  changeNote?: string;
}

/** Search/filter query */
export interface KeyQuery {
  platform?: string;
  function?: string;
  tag?: string;
  status?: string;
  keyword?: string;    // fuzzy search across all text fields
}

/** Platform summary for grouping */
export interface PlatformSummary {
  platform: string;
  keys: KeyEntry[];
  functions: string[];
}
