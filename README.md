# sentvia-mcp

MCP server for [SentVia](https://sentvia.ai) — email infrastructure for AI agents.

Gives any MCP-capable agent (Claude Code, Claude Desktop, OpenClaw, or your own
MCP host) email as native tools: create inboxes, send, reply, forward, search,
read threads, manage drafts, custom domains, webhooks, and allow/block rules —
21 tools, each a thin wrapper over the [SentVia REST API](https://docs.sentvia.ai/api-reference/introduction).

## Setup

You need a SentVia API key (`sv_live_…`) from the [dashboard](https://console.sentvia.ai).

**Claude Code**

```bash
claude mcp add sentvia --env SENTVIA_API_KEY=sv_live_… -- npx -y sentvia-mcp
```

**Claude Desktop / any JSON-config MCP host**

```json
{
  "mcpServers": {
    "sentvia": {
      "command": "npx",
      "args": ["-y", "sentvia-mcp"],
      "env": { "SENTVIA_API_KEY": "sv_live_…" }
    }
  }
}
```

**OpenClaw**

```bash
openclaw mcp add sentvia --command npx --arg -y --arg sentvia-mcp
```

then add `SENTVIA_API_KEY` to the server's `env` in `~/.openclaw/openclaw.json`.
Full guide: [docs.sentvia.ai/frameworks/openclaw](https://docs.sentvia.ai/frameworks/openclaw).

## Tools

| Area | Tools |
| --- | --- |
| Inboxes | `create_inbox` · `list_inboxes` · `delete_inbox` |
| Messages | `send_message` · `reply_to_message` · `forward_message` · `get_message` · `search_messages` |
| Threads | `list_threads` · `get_thread` |
| Drafts | `create_draft` · `send_draft` · `list_drafts` |
| Domains | `add_domain` · `get_domain` |
| Webhooks | `create_webhook` · `list_webhooks` · `delete_webhook` |
| Allow/block | `add_address_rule` · `list_address_rules` · `delete_address_rule` |

Replies thread correctly (In-Reply-To/References set automatically), search
supports keyword, semantic, and hybrid modes, and sends respect the same
idempotency and suppression rules as the REST API.

## Configuration

| Env var | Required | Default |
| --- | --- | --- |
| `SENTVIA_API_KEY` | yes | — |
| `SENTVIA_BASE_URL` | no | `https://api.sentvia.ai` |

## Docs

- [MCP guide](https://docs.sentvia.ai/guides/mcp)
- [API reference](https://docs.sentvia.ai/api-reference/introduction)
- [SentVia for agents](https://docs.sentvia.ai/for-agents)
