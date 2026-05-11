# Keyring

> API Key Manager for AI Agents — 专为 AI Agent 设计的 API 密钥管理服务

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)

English | [中文](#中文)

---

## What is Keyring

Keyring is a **lightweight, self-hosted** service for managing API keys across platforms — built specifically for **AI agents**.

Instead of scattering API keys across `.env` files, config files, and environment variables, Keyring gives your agents a single, structured, searchable store for all their credentials.

### Why not use Vault / Infisical?

| | HashiCorp Vault | Infisical | Keyring |
|---|---|---|---|
| **Deploy** | Complex (Go binary, storage backend) | Needs PostgreSQL | **Single JSON file** |
| **Target** | Enterprise teams | Dev teams | **Solo developers / AI agents** |
| **MCP support** | Via plugin | Via plugin | **Native, with auto-discovery** |
| **Weight** | Heavy | Medium | **~5 MB** |

Keyring fills the gap between `.env` files (too primitive) and enterprise secret managers (too heavy).

### Key Features

- **8 MCP tools** — agents can list, search, get, add, update, revoke keys, view version history, get summaries
- **MCP auto-discovery** — `/.well-known/mcp`, `/llms.txt`, HTML `<link>` tags, HTTP `Link` header
- **Version control** — every edit saves a snapshot; full history per key
- **Soft delete** — revoked keys stay in the store, can be reactivated
- **Semi-structured data** — models, tags, notes are flexible fields
- **WebUI** — visual management at port 5179
- **Zero dependencies** — JSON file storage, atomic writes, no database needed
- **Two transport modes** — HTTP (Streamable HTTP) for remote, stdio for local

---

## Quick Start

### Option 1: Docker (recommended)

```bash
git clone https://github.com/Leeson-Wong/Keyring.git
cd Keyring
cp config.example.json config.json
docker compose up -d
```

Visit `http://localhost:5179` for the WebUI.  
MCP endpoint: `http://localhost:5179/mcp`

### Option 2: npm

```bash
git clone https://github.com/Leeson-Wong/Keyring.git
cd Keyring
npm install
npm run build
cp config.example.json config.json
npm start
```

### Option 3: stdio (local MCP client)

For Claude Desktop, Cursor, or any MCP client that supports stdio:

```json
{
  "mcpServers": {
    "keyring": {
      "command": "npx",
      "args": ["tsx", "server/stdio.ts"],
      "cwd": "/path/to/Keyring"
    }
  }
}
```

---

## MCP Configuration

### HTTP mode (remote / LAN)

```json
{
  "mcpServers": {
    "keyring": {
      "url": "http://YOUR_HOST:5179/mcp"
    }
  }
}
```

### Auto-discovery

Any MCP-compatible agent visiting the root URL will find the MCP endpoint via:
- `/.well-known/mcp` — machine-readable JSON
- `/llms.txt` — LLM-readable markdown
- HTML `<link>` tags in the homepage
- HTTP `Link` response header

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_keys` | List keys, optionally filtered by platform / function / status |
| `get_key` | Get full details of a key (including the actual API key value) |
| `search_keys` | Full-text search across all fields |
| `add_key` | Add a new API key |
| `update_key` | Update a key (auto-saves version) |
| `revoke_key` | Soft-delete a key |
| `get_versions` | View version history |
| `get_summary` | Overview: counts, platforms, functions, tags |

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/keys` | List all keys |
| GET | `/api/keys/:id` | Get a key |
| POST | `/api/keys` | Create a key |
| PUT | `/api/keys/:id` | Update a key |
| DELETE | `/api/keys/:id` | Revoke a key (soft delete) |
| GET | `/api/keys/:id/versions` | Version history |
| GET | `/api/meta` | Platforms, functions, tags |
| POST | `/mcp` | MCP endpoint |
| GET | `/health` | Health check |

---

## Data Model

```json
{
  "id": "uuid",
  "platform": "openai",
  "function": "llm",
  "endpoint": "https://api.openai.com/v1",
  "models": ["gpt-4o", "gpt-4o-mini"],
  "apiKey": "sk-...",
  "name": "My OpenAI key",
  "tags": ["production", "coding"],
  "notes": "Main key for code generation",
  "status": "active",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z",
  "versions": []
}
```

---

## Security Notes

### LAN / Local deployment (recommended)

If you deploy Keyring on a local network (e.g. VMware internal IP, home LAN), there's **no attack surface** — the service is not exposed to the public internet. In this case, **no authentication is needed**. This is the default and recommended usage.

### Public deployment

If you need to expose Keyring to the public internet, you **must** add authentication. Options:

1. **Reverse proxy with Basic Auth** — simplest approach (Nginx / Caddy)
2. **API key header** — check `Authorization` header in a middleware
3. **Reference implementation** — see [resume-maker](https://github.com/Leeson-Wong/resume-maker) for a working example with invite-code authentication, rate limiting, and MCP discovery
4. **Use a VPN / tunnel** — WireGuard, Tailscale, or Cloudflare Tunnel to avoid direct exposure

> ⚠️ **Never deploy Keyring to the public internet without authentication.** Your API keys are stored in plaintext.

---

## Config

```json
{
  "port": 5179,
  "dataPath": "./data"
}
```

Or via environment variables:

```bash
PORT=5179 DATA_PATH=./data npm start
```

---

## Project Structure

```
Keyring/
├── server/               # Backend (Node.js + MCP SDK)
│   ├── index.ts          # HTTP server + API routes + MCP discovery
│   ├── stdio.ts          # stdio MCP transport
│   ├── storage.ts        # JSON file storage engine
│   └── config.ts         # Config loader
├── mcp/                  # MCP server + tools
│   ├── create-server.ts  # McpServer factory
│   └── tools/index.ts    # 8 MCP tool definitions
├── src/                  # Frontend (React 19 + Vite 7 + Tailwind CSS 4)
│   ├── types/keyring.ts  # Shared types
│   └── ...               # React components
├── data/                 # Runtime data (gitignored)
│   └── keyring.json      # Key store
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Tech Stack

- **Backend**: Node.js, TypeScript, MCP SDK, Zod
- **Frontend**: React 19, Vite 7, Tailwind CSS 4
- **Storage**: JSON file (atomic writes, no database)
- **Deploy**: Docker, docker-compose, or bare Node.js

---

## Use Cases

### 1. AI Agent key vault
Your Hermes / Claude / Cursor agent needs OpenAI, Anthropic, ElevenLabs keys. Instead of scattering them in config files, store them in Keyring and let agents query via MCP.

### 2. Multi-key rotation
Multiple keys per platform? Keyring tracks them all with version history. When you rotate a key, the old version is preserved.

### 3. Team key sharing (LAN)
Deploy on a shared server. Everyone on the LAN can access the same keys via MCP or WebUI.

---

## License

MIT

---

## 中文

### 一句话介绍

Keyring 是一个专为 AI Agent 设计的 API 密钥管理服务，轻量自托管，支持 MCP 协议，Agent 可以直接通过工具调用来查询、添加、更新密钥。

### 为什么做这个

每个用 AI Agent 的人都有一堆 API Key：OpenAI、Anthropic、ElevenLabs、各种搜索 API……这些 key 散落在 `.env`、配置文件、环境变量里，Agent 找不到、人也记不清。

现有的方案：
- **HashiCorp Vault** — 企业级，太重
- **Infisical** — 需要数据库，部署复杂
- **.env 文件** — 太原始，没有结构化、没有版本控制

Keyring 填的就是这个中间地带：**比 .env 结构化，比 Vault 轻量，原生支持 MCP 让 Agent 直接用**。

### 安全说明

- **内网部署**（推荐）：没有攻击面，不需要设置认证
- **公网部署**：务必加认证。最简单的是 Nginx 反代 + Basic Auth，或者参考 [resume-maker](https://github.com/Leeson-Wong/resume-maker) 的邀请码认证方案
