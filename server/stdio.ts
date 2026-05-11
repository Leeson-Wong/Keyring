import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { Storage } from './storage.js';
import { createMcpServer } from '../mcp/create-server.js';

async function main() {
  const config = await loadConfig();
  const storage = new Storage(config.dataPath);
  await storage.init();
  const server = createMcpServer(storage);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Keyring MCP server running in stdio mode');
}

main().catch((err) => { console.error('Failed to start:', err.message); process.exit(1); });
