import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Storage } from '../server/storage.js';
import { registerTools } from './tools/index.js';

export function createMcpServer(storage: Storage): McpServer {
  const server = new McpServer({
    name: 'keyring',
    version: '1.0.0',
  });

  registerTools(server, storage);

  return server;
}
