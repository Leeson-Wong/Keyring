import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { Storage } from './storage.js';
import { createMcpServer } from '../mcp/create-server.js';
import type { CreateKeyInput, UpdateKeyInput } from '../src/types/keyring.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function main() {
  const config = await loadConfig();
  const storage = new Storage(config.dataPath);
  await storage.init();

  // Static files dir: dist/ has Vite build output
  const distDir = join(process.cwd(), 'dist');

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    try {
      const url = (req.url ?? '/').split('?')[0];
      const method = req.method ?? 'GET';

      // ─── MCP endpoint ───
      if (url === '/mcp' && method === 'POST') {
        const mcpServer = createMcpServer(storage);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on('close', () => transport.close());
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      // ─── GET /api/keys ───
      if (url === '/api/keys' && method === 'GET') {
        json(res, 200, storage.getAll());
        return;
      }

      // ─── GET /api/keys/:id ───
      const keyMatch = url.match(/^\/api\/keys\/([^/]+)$/);
      if (keyMatch && method === 'GET') {
        const entry = storage.getById(keyMatch[1]);
        json(res, entry ? 200 : 404, entry || { error: 'Not found' });
        return;
      }

      // ─── GET /api/keys/:id/versions ───
      const verMatch = url.match(/^\/api\/keys\/([^/]+)\/versions$/);
      if (verMatch && method === 'GET') {
        json(res, 200, storage.getVersions(verMatch[1]));
        return;
      }

      // ─── POST /api/keys ───
      if (url === '/api/keys' && method === 'POST') {
        const body: CreateKeyInput = JSON.parse(await readBody(req));
        const entry = await storage.create(body);
        json(res, 201, entry);
        return;
      }

      // ─── PUT /api/keys/:id ───
      if (keyMatch && method === 'PUT') {
        const body = JSON.parse(await readBody(req));
        const entry = await storage.update(keyMatch[1], body, body.changeNote);
        json(res, entry ? 200 : 404, entry || { error: 'Not found' });
        return;
      }

      // ─── DELETE /api/keys/:id (revoke) ───
      if (keyMatch && method === 'DELETE') {
        const entry = await storage.revoke(keyMatch[1]);
        json(res, entry ? 200 : 404, entry || { error: 'Not found' });
        return;
      }

      // ─── GET /api/meta ───
      if (url === '/api/meta' && method === 'GET') {
        json(res, 200, {
          platforms: storage.getPlatforms(),
          functions: storage.getFunctions(),
          tags: storage.getTags(),
          total: storage.getAll().length,
        });
        return;
      }

      const MCP_LINK_HEADER = '</.well-known/mcp>; rel="mcp"; type="application/json", </llms.txt>; rel="llms-txt"; type="text/markdown"';

      // ─── Well-Known MCP Discovery ───
      if (url === '/.well-known/mcp' && method === 'GET') {
        const host = req.headers.host ?? `localhost:${config.port}`;
        const baseUrl = `http://${host}`;
        res.writeHead(200, {
          'Content-Type': 'application/json',
          ...CORS,
        });
        res.end(JSON.stringify({
          mcp: {
            endpoint: `${baseUrl}/mcp`,
            transport: 'http',
            auth: { type: 'none', description: 'No authentication required.' },
            tools: [
              { name: 'list_keys', description: 'List API keys, optionally filtered by platform/function/status.' },
              { name: 'get_key', description: 'Get full details of a key including the full API key value.' },
              { name: 'search_keys', description: 'Full-text search across all key fields.' },
              { name: 'add_key', description: 'Add a new API key.' },
              { name: 'update_key', description: 'Update an existing key (auto-saves version history).' },
              { name: 'revoke_key', description: 'Soft-delete a key.' },
              { name: 'get_versions', description: 'View version history of a key.' },
              { name: 'get_summary', description: 'Overview: counts, platforms, functions, tags.' },
            ],
          },
        }, null, 2));
        return;
      }

      // ─── LLMs.txt Discovery ───
      if (url === '/llms.txt' && method === 'GET') {
        const host = req.headers.host ?? `localhost:${config.port}`;
        const baseUrl = `http://${host}`;
        const md = `# Keyring — API Key Manager

Keyring is an API key management service. Store, organize, and share API keys via MCP.

## MCP Endpoint

- URL: ${baseUrl}/mcp
- Transport: HTTP (Streamable HTTP)
- Auth: None

## Tools

- **list_keys**: List all API keys, optionally filtered by platform, function, or status. Keys are masked by default.
- **get_key**: Get full details of a specific API key by ID or by platform+function lookup. Returns the full API key value.
- **search_keys**: Full-text search across all key fields (platform, function, endpoint, models, tags, notes, name).
- **add_key**: Add a new API key entry with platform, function, endpoint, models, tags, and notes.
- **update_key**: Update an existing key. Previous version is automatically saved in version history.
- **revoke_key**: Soft-delete (revoke) an API key. Stays in database but marked as revoked.
- **get_versions**: Get the version history of a specific key showing all previous snapshots.
- **get_summary**: Get an overview: total keys, platforms, functions, tags, active/revoked counts.

## Discovery

- Well-known: ${baseUrl}/.well-known/mcp
- This file: ${baseUrl}/llms.txt
`;
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', ...CORS });
        res.end(md);
        return;
      }

      // ─── Health ───
      if (url === '/health') {
        json(res, 200, { name: 'keyring', version: '1.0.0', status: 'running', keys: storage.getAll().length });
        return;
      }

      // ─── Static files (SPA) ───
      const filePath = join(distDir, url === '/' ? 'index.html' : url);
      if (existsSync(filePath)) {
        const ext = extname(filePath).toLowerCase();
        const mime = MIME[ext];
        if (mime) {
          let data = await readFile(filePath);
          // For index.html, inject MCP discovery tags into <head>
          if (url === '/' || url === '/index.html') {
            let html = data.toString('utf-8');
            html = html.replace('</head>', `<link rel="mcp" href="/mcp">\n<link rel="llms-txt" href="/llms.txt">\n</head>`);
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Link': MCP_LINK_HEADER,
            });
            res.end(html);
            return;
          }
          res.writeHead(200, { 'Content-Type': mime });
          res.end(data);
          return;
        }
      }
      // SPA fallback
      const indexHtml = join(distDir, 'index.html');
      if (existsSync(indexHtml)) {
        const html = await readFile(indexHtml, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      json(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('Request error:', err);
      if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
    }
  });

  // Graceful shutdown
  let shuttingDown = false;
  function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}, shutting down...`);
    server.close(() => { console.log('Server closed.'); process.exit(0); });
    setTimeout(() => { process.exit(1); }, 5000);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  server.listen(config.port, () => {
    console.log(`\nKeyring running at http://localhost:${config.port}`);
    console.log(`  Health: http://localhost:${config.port}/health`);
    console.log(`  MCP:    http://localhost:${config.port}/mcp`);
    console.log(`  API:    http://localhost:${config.port}/api/keys`);
    console.log(`  WebUI:  http://localhost:${config.port}/`);
    console.log(`\nWaiting for connections...`);
  });
}

main().catch((err) => { console.error('Failed to start:', err.message); process.exit(1); });
