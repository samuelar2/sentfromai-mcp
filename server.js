#!/usr/bin/env node
// SentFromAI MCP server — the agent-native distribution channel. Every tool is one
// authenticated HTTP call to the REST API; no business logic or DB access here,
// which keeps SentFromAI portable (swap the backend, keep the MCP surface).
//
// Config via env: SENTFROMAI_API_KEY (required — a tenant bearer token),
// SENTFROMAI_BASE_URL (default https://api.sentfrom.ai).
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const BASE_URL = process.env.SENTFROMAI_BASE_URL ?? 'https://api.sentfrom.ai'
const API_KEY = process.env.SENTFROMAI_API_KEY ?? ''

if (!API_KEY) {
  console.error(
    'sentfromai-mcp: SENTFROMAI_API_KEY is not set.\n' +
      'Get an API key at https://console.sentfrom.ai and set it in the `env` of your MCP config.\n' +
      'Docs: https://docs.sentfrom.ai/guides/mcp',
  )
  process.exit(1)
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`sentfromai ${method} ${path} -> ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

const TOOLS = [
  // ── Inboxes ──────────────────────────────────────────────────────────────
  {
    name: 'create_inbox',
    description: 'Create a new email inbox. Defaults to the managed mail.sentfrom.ai domain.',
    inputSchema: {
      type: 'object',
      properties: {
        local_part: { type: 'string', description: 'The part before @ (e.g. "support" or a user hash).' },
        display_name: { type: 'string', description: 'Optional display name shown in the From header.' },
      },
      required: ['local_part'],
    },
  },
  {
    name: 'list_inboxes',
    description: 'List all inboxes for this tenant.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'delete_inbox',
    description: 'Delete an inbox. Mail to its address stops being accepted.',
    inputSchema: {
      type: 'object',
      properties: { inbox_id: { type: 'string' } },
      required: ['inbox_id'],
    },
  },
  // ── Messages ─────────────────────────────────────────────────────────────
  {
    name: 'send_message',
    description: 'Send a new email from one of your inboxes.',
    inputSchema: {
      type: 'object',
      properties: {
        inbox_id: { type: 'string', description: 'The sending inbox id.' },
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses.' },
        cc: { type: 'array', items: { type: 'string' } },
        bcc: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        text: { type: 'string', description: 'Plain-text body.' },
        html: { type: 'string', description: 'Optional HTML body.' },
        attachments: {
          type: 'array',
          description: 'Optional file attachments.',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content_type: { type: 'string' },
              content_base64: { type: 'string', description: 'Base64-encoded file content.' },
            },
            required: ['content_base64'],
          },
        },
      },
      required: ['inbox_id', 'to', 'subject'],
    },
  },
  {
    name: 'reply_to_message',
    description: 'Reply to a message, staying in its thread (sets In-Reply-To/References automatically).',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'The id of the message to reply to.' },
        text: { type: 'string' },
        html: { type: 'string' },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'forward_message',
    description: 'Forward a message to new recipients in a fresh thread, quoting the original and re-attaching its files.',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'The id of the message to forward.' },
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses.' },
        text: { type: 'string', description: 'Optional note placed above the quoted original.' },
        from_inbox_id: { type: 'string', description: 'Optional: send from a different inbox than the one that received the original.' },
      },
      required: ['message_id', 'to'],
    },
  },
  {
    name: 'get_message',
    description: 'Fetch a single message by id, including body and attachment links.',
    inputSchema: {
      type: 'object',
      properties: { message_id: { type: 'string' } },
      required: ['message_id'],
    },
  },
  {
    name: 'search_messages',
    description: 'Search messages across the tenant. mode: keyword (default), semantic (by meaning), or hybrid. No query returns recent messages.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        mode: { type: 'string', enum: ['keyword', 'semantic', 'hybrid'], description: 'Search mode.' },
        inbox_id: { type: 'string', description: 'Optional: restrict to one inbox.' },
        limit: { type: 'number' },
      },
    },
  },
  // ── Threads ──────────────────────────────────────────────────────────────
  {
    name: 'list_threads',
    description: 'List conversation threads, most recently active first.',
    inputSchema: {
      type: 'object',
      properties: {
        inbox_id: { type: 'string', description: 'Optional: restrict to one inbox.' },
        limit: { type: 'number', description: 'Max threads to return (default 25, max 100).' },
      },
    },
  },
  {
    name: 'get_thread',
    description: 'Fetch a thread and all its messages in order.',
    inputSchema: {
      type: 'object',
      properties: { thread_id: { type: 'string' } },
      required: ['thread_id'],
    },
  },
  // ── Drafts ───────────────────────────────────────────────────────────────
  {
    name: 'create_draft',
    description: 'Create a draft (optionally scheduled, optionally a reply). Does not send.',
    inputSchema: {
      type: 'object',
      properties: {
        inbox_id: { type: 'string' },
        to: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        text: { type: 'string' },
        html: { type: 'string' },
        reply_to_message_id: { type: 'string', description: 'Make this draft a reply to a message.' },
        scheduled_at: { type: 'string', description: 'ISO timestamp to auto-send at.' },
      },
      required: ['inbox_id'],
    },
  },
  {
    name: 'send_draft',
    description: 'Send an existing draft immediately.',
    inputSchema: {
      type: 'object',
      properties: { draft_id: { type: 'string' } },
      required: ['draft_id'],
    },
  },
  {
    name: 'list_drafts',
    description: 'List drafts for this tenant.',
    inputSchema: { type: 'object', properties: {} },
  },
  // ── Domains ──────────────────────────────────────────────────────────────
  {
    name: 'add_domain',
    description: 'Add a custom sending domain. Returns the DNS records to add to your DNS; verification is automatic once they propagate.',
    inputSchema: {
      type: 'object',
      properties: { hostname: { type: 'string' } },
      required: ['hostname'],
    },
  },
  {
    name: 'get_domain',
    description: 'Get a domain’s verification status and required DNS records.',
    inputSchema: {
      type: 'object',
      properties: { domain_id: { type: 'string' } },
      required: ['domain_id'],
    },
  },
  // ── Webhooks ─────────────────────────────────────────────────────────────
  {
    name: 'create_webhook',
    description: 'Register a webhook endpoint for delivery events. The signing secret is returned once on creation — store it.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTPS endpoint to receive events.' },
        events: { type: 'array', items: { type: 'string' }, description: 'Event types (default ["message.received"]).' },
      },
      required: ['url'],
    },
  },
  {
    name: 'list_webhooks',
    description: 'List webhook endpoints (signing secrets omitted).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'delete_webhook',
    description: 'Delete a webhook endpoint.',
    inputSchema: {
      type: 'object',
      properties: { webhook_id: { type: 'string' } },
      required: ['webhook_id'],
    },
  },
  // ── Allow/block lists ────────────────────────────────────────────────────
  {
    name: 'add_address_rule',
    description: 'Add an allow or block rule for an email address or bare domain. Block rules are enforced on both send and receive.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['allow', 'block'] },
        pattern: { type: 'string', description: 'Email address or bare domain (e.g. "spam.example").' },
        direction: { type: 'string', enum: ['inbound', 'outbound', 'both'], description: 'Default: both.' },
      },
      required: ['kind', 'pattern'],
    },
  },
  {
    name: 'list_address_rules',
    description: 'List allow/block rules for this tenant.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'delete_address_rule',
    description: 'Delete an allow/block rule.',
    inputSchema: {
      type: 'object',
      properties: { rule_id: { type: 'string' } },
      required: ['rule_id'],
    },
  },
]

const server = new Server({ name: 'sentfromai', version: '0.2.1' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name } = req.params
  const a = req.params.arguments ?? {}
  let result
  switch (name) {
    case 'create_inbox':
      result = await api('POST', '/inboxes', { local_part: a.local_part, display_name: a.display_name })
      break
    case 'list_inboxes':
      result = await api('GET', '/inboxes')
      break
    case 'delete_inbox':
      result = await api('DELETE', `/inboxes/${a.inbox_id}`)
      break
    case 'send_message':
      result = await api('POST', '/messages', {
        inbox_id: a.inbox_id, to: a.to, cc: a.cc, bcc: a.bcc,
        subject: a.subject, text: a.text, html: a.html, attachments: a.attachments,
      })
      break
    case 'reply_to_message':
      result = await api('POST', `/messages/${a.message_id}/reply`, { text: a.text, html: a.html })
      break
    case 'forward_message':
      result = await api('POST', `/messages/${a.message_id}/forward`, {
        to: a.to, text: a.text, from_inbox_id: a.from_inbox_id,
      })
      break
    case 'get_message':
      result = await api('GET', `/messages/${a.message_id}`)
      break
    case 'search_messages': {
      const qs = new URLSearchParams()
      if (a.query) qs.set('query', a.query)
      if (a.mode) qs.set('mode', a.mode)
      if (a.inbox_id) qs.set('inbox_id', a.inbox_id)
      if (a.limit) qs.set('limit', String(a.limit))
      result = await api('GET', `/messages?${qs.toString()}`)
      break
    }
    case 'list_threads': {
      const qs = new URLSearchParams()
      if (a.inbox_id) qs.set('inbox_id', a.inbox_id)
      if (a.limit) qs.set('limit', String(a.limit))
      result = await api('GET', `/threads?${qs.toString()}`)
      break
    }
    case 'get_thread':
      result = await api('GET', `/threads/${a.thread_id}`)
      break
    case 'create_draft':
      result = await api('POST', '/drafts', {
        inbox_id: a.inbox_id, to: a.to, subject: a.subject, text: a.text, html: a.html,
        reply_to_message_id: a.reply_to_message_id, scheduled_at: a.scheduled_at,
      })
      break
    case 'send_draft':
      result = await api('POST', `/drafts/${a.draft_id}/send`)
      break
    case 'list_drafts':
      result = await api('GET', '/drafts')
      break
    case 'add_domain':
      result = await api('POST', '/domains', { hostname: a.hostname })
      break
    case 'get_domain':
      result = await api('GET', `/domains/${a.domain_id}`)
      break
    case 'create_webhook':
      result = await api('POST', '/webhooks', { url: a.url, events: a.events })
      break
    case 'list_webhooks':
      result = await api('GET', '/webhooks')
      break
    case 'delete_webhook':
      result = await api('DELETE', `/webhooks/${a.webhook_id}`)
      break
    case 'add_address_rule':
      result = await api('POST', '/lists', { kind: a.kind, pattern: a.pattern, direction: a.direction })
      break
    case 'list_address_rules':
      result = await api('GET', '/lists')
      break
    case 'delete_address_rule':
      result = await api('DELETE', `/lists/${a.rule_id}`)
      break
    default:
      throw new Error(`unknown tool: ${name}`)
  }
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
