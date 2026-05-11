import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { KeyEntry, KeyVersion, CreateKeyInput, UpdateKeyInput, KeyQuery } from '../src/types/keyring.js';

const DATA_FILE = 'keyring.json';

export class Storage {
  private dataPath: string;
  private filePath: string;
  private keys: KeyEntry[] = [];

  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.filePath = join(dataPath, DATA_FILE);
  }

  async init(): Promise<void> {
    if (!existsSync(this.dataPath)) {
      await mkdir(this.dataPath, { recursive: true });
    }
    if (existsSync(this.filePath)) {
      const raw = await readFile(this.filePath, 'utf-8');
      this.keys = JSON.parse(raw);
    } else {
      this.keys = [];
      await this.persist();
    }
    console.log(`Storage initialized: ${this.keys.length} keys loaded from ${this.filePath}`);
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.keys, null, 2), 'utf-8');
  }

  private snapshot(entry: Omit<KeyEntry, 'versions'>): Omit<KeyEntry, 'versions'> {
    return JSON.parse(JSON.stringify(entry));
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  getAll(): KeyEntry[] {
    return this.keys;
  }

  getById(id: string): KeyEntry | undefined {
    return this.keys.find(k => k.id === id);
  }

  search(query: KeyQuery): KeyEntry[] {
    let results = this.keys;

    if (query.platform) {
      const q = query.platform.toLowerCase();
      results = results.filter(k => k.platform.toLowerCase().includes(q));
    }
    if (query.function) {
      const q = query.function.toLowerCase();
      results = results.filter(k => k.function.toLowerCase().includes(q));
    }
    if (query.tag) {
      const q = query.tag.toLowerCase();
      results = results.filter(k => k.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (query.status) {
      results = results.filter(k => k.status === query.status);
    }
    if (query.keyword) {
      const q = query.keyword.toLowerCase();
      results = results.filter(k => {
        const text = [k.platform, k.function, k.endpoint, k.name, k.notes, ...k.models, ...k.tags]
          .join(' ')
          .toLowerCase();
        return text.includes(q);
      });
    }

    return results;
  }

  async create(input: CreateKeyInput): Promise<KeyEntry> {
    const now = new Date().toISOString();
    const entry: KeyEntry = {
      id: randomUUID(),
      platform: input.platform,
      function: input.function,
      endpoint: input.endpoint || '',
      models: input.models || [],
      apiKey: input.apiKey,
      name: input.name || `${input.platform}-${input.function}`,
      tags: input.tags || [],
      notes: input.notes || '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    this.keys.push(entry);
    await this.persist();
    return entry;
  }

  async update(id: string, input: UpdateKeyInput, changeNote?: string): Promise<KeyEntry | null> {
    const idx = this.keys.findIndex(k => k.id === id);
    if (idx === -1) return null;

    const entry = this.keys[idx];

    // Save version snapshot before modification
    const version: KeyVersion = {
      version: entry.versions.length + 1,
      timestamp: new Date().toISOString(),
      snapshot: this.snapshot(entry),
      changeNote,
    };
    entry.versions.push(version);

    // Apply updates
    if (input.platform !== undefined) entry.platform = input.platform;
    if (input.function !== undefined) entry.function = input.function;
    if (input.endpoint !== undefined) entry.endpoint = input.endpoint;
    if (input.models !== undefined) entry.models = input.models;
    if (input.apiKey !== undefined) entry.apiKey = input.apiKey;
    if (input.name !== undefined) entry.name = input.name;
    if (input.tags !== undefined) entry.tags = input.tags;
    if (input.notes !== undefined) entry.notes = input.notes;
    if (input.status !== undefined) entry.status = input.status;

    entry.updatedAt = new Date().toISOString();

    await this.persist();
    return entry;
  }

  async revoke(id: string, changeNote?: string): Promise<KeyEntry | null> {
    const entry = this.keys.find(k => k.id === id);
    if (!entry) return null;

    // Save version
    const version: KeyVersion = {
      version: entry.versions.length + 1,
      timestamp: new Date().toISOString(),
      snapshot: this.snapshot(entry),
      changeNote: changeNote || 'Revoked',
    };
    entry.versions.push(version);

    entry.status = 'revoked';
    entry.revokedAt = new Date().toISOString();
    entry.updatedAt = entry.revokedAt;

    await this.persist();
    return entry;
  }

  /** Get version history for a key */
  getVersions(id: string): KeyVersion[] {
    const entry = this.keys.find(k => k.id === id);
    return entry?.versions || [];
  }

  /** List all unique platforms */
  getPlatforms(): string[] {
    return [...new Set(this.keys.map(k => k.platform))].sort();
  }

  /** List all unique functions */
  getFunctions(): string[] {
    return [...new Set(this.keys.map(k => k.function))].sort();
  }

  /** List all unique tags */
  getTags(): string[] {
    const tags = new Set<string>();
    this.keys.forEach(k => k.tags.forEach(t => tags.add(t)));
    return [...tags].sort();
  }

  /** Get summary grouped by platform */
  getByPlatform(): Map<string, KeyEntry[]> {
    const map = new Map<string, KeyEntry[]>();
    for (const k of this.keys) {
      const list = map.get(k.platform) || [];
      list.push(k);
      map.set(k.platform, list);
    }
    return map;
  }
}
