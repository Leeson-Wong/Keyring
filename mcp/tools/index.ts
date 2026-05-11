import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';
import type { KeyEntry, KeyQuery } from '../../src/types/keyring.js';
import type { Storage } from '../../server/storage.js';

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

function formatEntry(e: KeyEntry, showFullKey: boolean): string {
  const k = showFullKey ? e.apiKey : maskKey(e.apiKey);
  const models = e.models.length ? e.models.join(', ') : '-';
  const tags = e.tags.length ? e.tags.join(', ') : '-';
  return [
    `[${e.id.slice(0, 8)}] ${e.name} (${e.status})`,
    `  Platform: ${e.platform} | Function: ${e.function}`,
    `  Endpoint: ${e.endpoint || '(default)'}`,
    `  Models: ${models}`,
    `  Key: ${k}`,
    `  Tags: ${tags}`,
    e.notes ? `  Notes: ${e.notes}` : '',
  ].filter(Boolean).join('\n');
}

export function registerTools(server: McpServer, storage: Storage): void {

  // 1. list_keys
  server.registerTool('list_keys', {
    title: 'List API Keys',
    description: 'List all API keys, optionally filtered by platform, function, or status. Keys are masked by default.',
    inputSchema: z.object({
      platform: z.string().optional().describe('Filter by platform name'),
      function: z.string().optional().describe('Filter by function (llm, tts, embedding, etc.)'),
      status: z.enum(['active', 'revoked', 'expired']).optional().describe('Filter by status'),
      show_full_key: z.boolean().optional().describe('Show full API keys (default: masked)'),
    }),
  }, async ({ platform, function: fn, status, show_full_key }): Promise<CallToolResult> => {
    try {
      const query: KeyQuery = {};
      if (platform) query.platform = platform;
      if (fn) query.function = fn;
      if (status) query.status = status;

      const results = storage.search(query);
      if (results.length === 0) {
        return { content: [{ type: 'text', text: 'No keys found.' }] };
      }

      const text = results.map(e => formatEntry(e, !!show_full_key)).join('\n\n');
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  // 2. get_key
  server.registerTool('get_key', {
    title: 'Get API Key',
    description: 'Get full details of a specific API key by ID, including the full API key value. Use this when an agent needs to actually use a key.',
    inputSchema: z.object({
      id: z.string().describe('Key ID (full UUID or first 8 chars)'),
      platform: z.string().optional().describe('Platform name (alternative lookup: find active key for platform+function)'),
      function: z.string().optional().describe('Function name (used with platform for alternative lookup)'),
    }),
  }, async ({ id, platform, function: fn }): Promise<CallToolResult> => {
    try {
      let entry: KeyEntry | undefined;

      if (id) {
        entry = storage.getById(id) || storage.getAll().find(k => k.id.startsWith(id));
      }
      if (!entry && platform && fn) {
        entry = storage.search({ platform, function: fn, status: 'active' })[0];
      }
      if (!entry) {
        return { content: [{ type: 'text', text: 'Key not found.' }] };
      }

      const text = [
        formatEntry(entry, true),
        '',
        `Created: ${entry.createdAt}`,
        `Updated: ${entry.updatedAt}`,
        entry.revokedAt ? `Revoked: ${entry.revokedAt}` : '',
        `Versions: ${entry.versions.length}`,
      ].filter(Boolean).join('\n');

      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  // 3. search_keys
  server.registerTool('search_keys', {
    title: 'Search API Keys',
    description: 'Full-text search across all key fields (platform, function, endpoint, models, tags, notes, name).',
    inputSchema: z.object({
      keyword: z.string().describe('Search keyword'),
      show_full_key: z.boolean().optional().describe('Show full API keys (default: masked)'),
    }),
  }, async ({ keyword, show_full_key }): Promise<CallToolResult> => {
    try {
      const results = storage.search({ keyword });
      if (results.length === 0) {
        return { content: [{ type: 'text', text: `No results for "${keyword}".` }] };
      }
      const text = results.map(e => formatEntry(e, !!show_full_key)).join('\n\n');
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  // 4. add_key
  server.registerTool('add_key', {
    title: 'Add API Key',
    description: 'Add a new API key entry to the keyring.',
    inputSchema: z.object({
      platform: z.string().describe('Platform name (e.g. openai, elevenlabs, silicon-flow)'),
      function: z.string().describe('Function category (e.g. llm, tts, stt, embedding, image-gen, video, search)'),
      api_key: z.string().describe('The API key value'),
      endpoint: z.string().optional().describe('API base URL'),
      models: z.array(z.string()).optional().describe('Associated model names'),
      name: z.string().optional().describe('Display name / alias'),
      tags: z.array(z.string()).optional().describe('Free-form tags'),
      notes: z.string().optional().describe('Notes'),
    }),
  }, async (input): Promise<CallToolResult> => {
    try {
      const entry = await storage.create({
        platform: input.platform,
        function: input.function,
        apiKey: input.api_key,
        endpoint: input.endpoint,
        models: input.models,
        name: input.name,
        tags: input.tags,
        notes: input.notes,
      });
      return { content: [{ type: 'text', text: `Key created: ${entry.id}\n${formatEntry(entry, false)}` }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  // 5. update_key
  server.registerTool('update_key', {
    title: 'Update API Key',
    description: 'Update an existing key entry. Previous version is automatically saved in history.',
    inputSchema: z.object({
      id: z.string().describe('Key ID to update'),
      platform: z.string().optional(),
      function: z.string().optional(),
      api_key: z.string().optional().describe('New API key value'),
      endpoint: z.string().optional(),
      models: z.array(z.string()).optional(),
      name: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      status: z.enum(['active', 'expired']).optional(),
      change_note: z.string().optional().describe('Note for this change (saved in version history)'),
    }),
  }, async ({ id, change_note, ...updates }): Promise<CallToolResult> => {
    try {
      const input = {
        ...updates,
        apiKey: updates.api_key,
      };
      delete (input as any).api_key;

      const entry = await storage.update(id, input, change_note);
      if (!entry) return errorResult(`Key not found: ${id}`);
      return { content: [{ type: 'text', text: `Updated: ${entry.id}\n${formatEntry(entry, false)}` }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  // 6. revoke_key
  server.registerTool('revoke_key', {
    title: 'Revoke API Key',
    description: 'Soft-delete (revoke) an API key. It stays in the database but is marked as revoked. Can be reactivated via update_key.',
    inputSchema: z.object({
      id: z.string().describe('Key ID to revoke'),
      reason: z.string().optional().describe('Reason for revocation'),
    }),
  }, async ({ id, reason }): Promise<CallToolResult> => {
    try {
      const entry = await storage.revoke(id, reason);
      if (!entry) return errorResult(`Key not found: ${id}`);
      return { content: [{ type: 'text', text: `Revoked: ${entry.id} (${entry.name})` }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  // 7. get_versions
  server.registerTool('get_versions', {
    title: 'Get Version History',
    description: 'Get the version history of a specific key. Shows all previous snapshots.',
    inputSchema: z.object({
      id: z.string().describe('Key ID'),
    }),
  }, async ({ id }): Promise<CallToolResult> => {
    try {
      const versions = storage.getVersions(id);
      if (versions.length === 0) {
        return { content: [{ type: 'text', text: `No version history for key ${id}.` }] };
      }
      const text = versions.map(v => {
        const s = v.snapshot;
        return [
          `v${v.version} @ ${v.timestamp}${v.changeNote ? ` - ${v.changeNote}` : ''}`,
          `  ${s.name} | ${s.platform}/${s.function} | key: ${maskKey(s.apiKey)} | status: ${s.status}`,
        ].join('\n');
      }).join('\n\n');
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  // 8. get_summary
  server.registerTool('get_summary', {
    title: 'Get Keyring Summary',
    description: 'Get an overview: total keys, platforms, functions, tags, active/revoked counts.',
    inputSchema: z.object({}),
  }, async (): Promise<CallToolResult> => {
    try {
      const all = storage.getAll();
      const active = all.filter(k => k.status === 'active').length;
      const revoked = all.filter(k => k.status === 'revoked').length;
      const expired = all.filter(k => k.status === 'expired').length;
      const platforms = storage.getPlatforms();
      const functions = storage.getFunctions();
      const tags = storage.getTags();

      const text = [
        `## Keyring Summary`,
        ``,
        `Total: ${all.length} keys (${active} active, ${revoked} revoked, ${expired} expired)`,
        ``,
        `Platforms (${platforms.length}): ${platforms.join(', ') || '-'}`,
        `Functions (${functions.length}): ${functions.join(', ') || '-'}`,
        `Tags (${tags.length}): ${tags.join(', ') || '-'}`,
      ].join('\n');
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });
}
