# sentfromai-mcp

MCP server for [SentFromAI](https://sentfrom.ai) — email infrastructure for AI agents.

Gives any MCP-capable agent (Claude Code, Claude Desktop, OpenClaw, or your own
MCP host) email as native tools: create inboxes, send, reply, forward, search,
read threads, manage drafts, custom domains, webhooks, and allow/block rules —
21 tools, each a thin wrapper over the [SentFromAI REST API](https://docs.sentfrom.ai/api-reference/introduction).

## Let your agent install it

Paste this into your agent (OpenClaw, Claude Code, any MCP-capable agent):

```text
Set up SentFromAI email for yourself: fetch https://docs.sentfrom.ai/agent-install.md
and follow it. Ask me for the API key when you need it.
```

## Manual setup

You need a SentFromAI API key (`sf_live_…`) from the [dashboard](https://console.sentfrom.ai).

**Claude Code**

```bash
claude mcp add sentfromai --env SENTFROMAI_API_KEY=sf_live_… -- npx -y sentfromai-mcp
```

**Claude Desktop / any JSON-config MCP host**

```json
{
  "mcpServers": {
    "sentfromai": {
      "command": "npx",
      "args": ["-y", "sentfromai-mcp"],
      "env": { "SENTFROMAI_API_KEY": "sf_live_…" }
    }
  }
}
```

**OpenClaw**

```bash
openclaw mcp add sentfromai --command npx --arg -y --arg sentfromai-mcp
```

then add `SENTFROMAI_API_KEY` to the server's `env` in `~/.openclaw/openclaw.json`.
Full guide: [docs.sentfrom.ai/frameworks/openclaw](https://docs.sentfrom.ai/frameworks/openclaw).

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
| `SENTFROMAI_API_KEY` | yes | — |
| `SENTFROMAI_BASE_URL` | no | `https://api.sentfrom.ai` |

## Docs

- [MCP guide](https://docs.sentfrom.ai/guides/mcp)
- [API reference](https://docs.sentfrom.ai/api-reference/introduction)
- [SentFromAI for agents](https://docs.sentfrom.ai/for-agents)
