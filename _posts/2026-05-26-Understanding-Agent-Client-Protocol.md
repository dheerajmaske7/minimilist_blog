---
layout: post
title: "Understanding Agent Client Protocol"
date: 2026-05-26
excerpt: "Agent Client Protocol (ACP) is the JSON-RPC layer for agent-to-agent communication — covering handshake, auth, named sessions, prompt turns, progress updates, permissions, and cancellation."
---

Imagine you are coordinating a project with a remote team of specialists. You do not re-introduce yourself on every call. You pick up where you left off: what was decided, what is pending, what you are still waiting on.

Your specialists come from different companies. One uses Slack, one uses email, one has their own system. You need a shared language before any real work can happen. Before you assign anything, you ask what they can actually do. Some tasks take hours or days, so you do not block on every reply. When priorities shift, you send **stop** on an existing thread, not a brand-new conversation. Handoffs must stay visible, and access must match trust.

Agentic communication on the internet has the same shape of problems:

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:28%;">Problem</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:72%;">Question</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">State</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Do agents remember what was said before?</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Interoperability</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Can my agent talk to yours in a shared format?</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Discovery</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Is my agent talking to the right agent?</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Async work</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">What happens when a task runs for a long time?</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Control</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Who can say stop, and will the other side listen?</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Trust</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Should every agent trust every other agent by default?</td>
    </tr>
  </tbody>
</table>

Think of **JSON-RPC** as the shared request format those coordinators use when they call each other. Instead of a vague Slack message (“can you look into shoes?”), every exchange is a structured note with three parts:

- **Method** — what you want done (`initialize`, `session/prompt`, …)
- **Params** — the details for that action (session id, user message, …)
- **Id** — a receipt number so the reply matches the right request

The other side answers in the same shape: either a **result** (success) or an **error** (failure), tied to that same id. Nobody has to guess what the message meant, and nobody has to invent a new envelope for every vendor.

**Agent Client Protocol (ACP)** sits on top of JSON-RPC 2.0. It is the vocabulary and sequence rules for agent-to-agent work: handshake, optional auth, named sessions, prompt turns, progress updates, permissions, and cancellation.

---

## What ACP is

ACP defines which JSON-RPC methods exist, what order they run in, and what each side may assume after every reply. Those messages flow between:

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:18%;">Role</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:28%;">Reference in the diagram</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:54%;">Responsibility</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><strong>Client</strong></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Buyer-side agent</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initiates requests</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><strong>Agent</strong></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Seller-side agent</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Holds session state, runs work, returns results</td>
    </tr>
  </tbody>
</table>

The client role is structural, not necessarily human. One agent acting for a user can be the client; another agent’s endpoint can be the agent. The protocol defines **requester and responder**.

Typical stack for a single conversation:

1. **Initialize** — agree version and capabilities
2. **Authenticate** (if required)
3. **Session setup** — create or restore a thread
4. **Prompt turns** — user messages, updates, permissions, cancel

---

## Initialization

Initialization is how every connection starts. The buyer-side agent sends `initialize` with a protocol version and capabilities; the seller-side agent replies with the agreed version and what it supports. **No session exists yet.** Only after this handshake can the buyer call `session/new`.

<figure style="text-align:center; margin: 0 0 1.5rem;">
  <img
    src="/assets/images/ACP_Article_assets/initialization.png"
    alt="Initialization sequence diagram"
    style="max-width: 820px; width: 100%; height: auto; border-radius: 10px;"
  />
  <figcaption style="font-size: 0.95rem; opacity: 0.8; margin-top: 8px;">
    Figure 1 — Initialization.
  </figcaption>
</figure>

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:6%;">Step</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:12%;">Stage</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:18%;">Buyer-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:18%;">Seller-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:46%;">Meaning</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Connection established</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Opens transport</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Accepts transport</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">HTTP (or similar) to a JSON-RPC endpoint. ACP defines messages, not transport.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">1</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialize</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>initialize</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives request; runs protocol version and capabilities check</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">First ACP message. Not a session yet.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">2</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialize response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives result</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>initialize</code> response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Buyer must finish this before any session method.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Ready for session setup</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">May call <code>session/new</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Ready for sessions</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Handshake complete. No user prompts exchanged yet.</td>
    </tr>
  </tbody>
</table>

#### Wire format

<div class="wire-pair" markdown="1">

<div class="wire-panel" markdown="1">

**Request — `initialize`**

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      },
      "terminal": true
    },
    "clientInfo": {
      "name": "buyer-side-agent",
      "title": "Buyer-side Agent",
      "version": "1.0.0"
    }
  }
}
```

</div>

<div class="wire-panel" markdown="1">

**Response**

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": {
        "image": true,
        "audio": true,
        "embeddedContext": true
      },
      "mcpCapabilities": {
        "http": true,
        "sse": true
      }
    },
    "agentInfo": {
      "name": "seller-side-agent",
      "title": "Seller-side Agent",
      "version": "1.0.0"
    },
    "authMethods": []
  }
}
```

</div>

</div>

The spec uses `clientCapabilities` / `clientInfo` on the request and `agentCapabilities` / `agentInfo` on the response. Those names map to **buyer** and **seller** roles in the handshake.

### Key rules — initialization

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Rule</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:78%;">Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Version</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>protocolVersion</code> is a major integer; both sides must agree.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Capabilities</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Omitted capability means unsupported.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Baseline</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">After init, the seller must support <code>session/new</code>, <code>session/prompt</code>, <code>session/cancel</code>, and <code>session/update</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Scope</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialization does not create a session or carry user prompts.</td>
    </tr>
  </tbody>
</table>

---

## Authentication

Authentication establishes trust **after** initialization. The seller advertises methods in `authMethods` on the initialize response. If required, the buyer calls `authenticate` with a matching `methodId` before session work continues.

<figure style="text-align:center; margin: 0 0 1.5rem;">
  <img
    src="/assets/images/ACP_Article_assets/authentication.png"
    alt="Authentication sequence diagram"
    style="max-width: 820px; width: 100%; height: auto; border-radius: 10px;"
  />
  <figcaption style="font-size: 0.95rem; opacity: 0.8; margin-top: 8px;">
    Figure 2 — Authentication.
  </figcaption>
</figure>

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:8%;">Step</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:14%;">Stage</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:26%;">Buyer-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Seller-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:30%;">Meaning</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Connection established</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Connected</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Connected</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Transport is open before authentication begins.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">1</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialize</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>initialize</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives request</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Starts the authentication handshake.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">2</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialize response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>initialize</code> response with <code>authMethods</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Seller advertises available authentication methods.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">3</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Authentication method</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>authenticate</code> with <code>methodId</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Validates method</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Buyer picks one advertised method.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">4</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Authentication response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives empty <code>result</code> on success</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Link is authenticated.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Authenticated</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">May call protected session methods</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Accepts protected calls</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Authenticated requests may proceed.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Re-auth note</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">May need to authenticate again</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">May require it</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">A new session may require authentication again.</td>
    </tr>
  </tbody>
</table>

#### Wire format

**Advertised at init**

```json
{
  "authMethods": [
    {
      "id": "agent-login",
      "name": "Agent login",
      "description": "Sign in using the agent login flow"
    }
  ]
}
```

<div class="wire-pair" markdown="1">

<div class="wire-panel" markdown="1">

**Request — `authenticate`**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "authenticate",
  "params": {
    "methodId": "agent-login"
  }
}
```

</div>

<div class="wire-panel" markdown="1">

**Response — `authenticate`**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

</div>

</div>

### Key rules — authentication

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Rule</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:78%;">Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Methods</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>methodId</code> in <code>authenticate</code> must match an <code>id</code> from <code>authMethods</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Optional</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Empty <code>authMethods</code> means the seller may not require <code>authenticate</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Re-auth</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">A new session may require authentication again.</td>
    </tr>
  </tbody>
</table>

---

## Session setup

A **session** is a named conversation with its own `sessionId`, history, and working state. Multi-step flows (ask → clarify → answer) stay on one thread instead of resending the full transcript every time.

**Example:** Turn 1 — buyer says “running shoes.” Turn 2 — seller asks for budget. Both turns use the same `sessionId` so the seller can rely on stored context.

<figure style="text-align:center; margin: 0 0 1.5rem;">
  <img
    src="/assets/images/ACP_Article_assets/session-setup.png"
    alt="Session setup sequence diagram"
    style="max-width: 820px; width: 100%; height: auto; border-radius: 10px;"
  />
  <figcaption style="font-size: 0.95rem; opacity: 0.8; margin-top: 8px;">
    Figure 3 — Session setup. MCP Servers are seller-side backends, not a third ACP peer.
  </figcaption>
</figure>

All paths below assume **Initialized** (and **authenticated**, if required).

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:6%;">Step</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:14%;">Phase</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:24%;">Buyer-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:24%;">Seller-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:32%;">Meaning</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialized</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Ready for session work</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Ready for session work</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialization (and authentication, if required) is complete.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">1</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Create session</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>session/new</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Creates session (may attach MCP)</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Starts a new thread.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">2</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Create response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Stores <code>sessionId</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Returns <code>sessionId</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">ID used on every later turn.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">3</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Load session</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>session/load</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Restores session</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Reconnect after restart; UI needs the full thread.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">4</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Load response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives load response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Returns load response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">History replay begins.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">4′</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">History update</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives updates</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Streams past messages as <code>session/update</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Conversation history is replayed during load.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">5</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Resume session</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>session/resume</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Restores session quietly</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Short disconnect; seller still has context.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">6</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Resume response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives confirmation</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Returns resume response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">No full history replay.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">7</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">List sessions</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends <code>session/list</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Queries stored sessions</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Discovery only; does not open a session.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">8</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">List response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives list</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Returns session metadata</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Buyer picks a <code>sessionId</code>, then calls <code>load</code> or <code>resume</code>.</td>
    </tr>
  </tbody>
</table>

### Create a new session

<div class="wire-pair" markdown="1">

<div class="wire-panel" markdown="1">

**Request — `session/new`**

```json
{
  "method": "session/new",
  "params": {
    "cwd": "/absolute/path",
    "mcpServers": []
  }
}
```

</div>

<div class="wire-panel" markdown="1">

**Response**

```json
{
  "result": {
    "sessionId": "sess_abc123"
  }
}
```

</div>

</div>

Use when starting a fresh conversation.

### Load vs resume

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Method</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:38%;">Buyer gets</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:40%;">When to use</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/load</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Full history replay via <code>session/update</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Reconnect after restart; UI needs the full thread.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/resume</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Quiet reconnect, no full replay</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Short disconnect; seller still has context.</td>
    </tr>
  </tbody>
</table>

<div class="wire-pair" markdown="1">

<div class="wire-panel" markdown="1">

**Request — `session/load`**

```json
{
  "method": "session/load",
  "params": {
    "sessionId": "sess_abc123",
    "cwd": "/absolute/path"
  }
}
```

</div>

<div class="wire-panel" markdown="1">

**Request — `session/resume`**

```json
{
  "method": "session/resume",
  "params": {
    "sessionId": "sess_abc123",
    "cwd": "/absolute/path"
  }
}
```

</div>

</div>

During load, the seller streams past messages as `session/update` notifications until load completes.

### List sessions

<div class="wire-pair" markdown="1">

<div class="wire-panel" markdown="1">

**Request — `session/list`**

```json
{
  "method": "session/list",
  "params": {}
}
```

</div>

<div class="wire-panel" markdown="1">

**Response (example)**

```json
{
  "result": {
    "sessions": [
      {
        "sessionId": "sess_abc123",
        "title": "Running shoes",
        "cwd": "/absolute/path"
      }
    ]
  }
}
```

</div>

</div>

### Key rules — session setup

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Rule</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:78%;">Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Order</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Complete <code>initialize</code> (and <code>authenticate</code> if required) first.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">ID</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Every <code>session/prompt</code> and <code>session/cancel</code> uses the same <code>sessionId</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/new</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Creates a new thread; returns a new <code>sessionId</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/load</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Requires <code>loadSession</code> capability; replays history.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/resume</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Requires <code>sessionCapabilities.resume</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/list</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Requires <code>sessionCapabilities.list</code>; discovery only.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>cwd</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Absolute path for the session working context.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>mcpServers</code></td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Tells the seller which tool or data backends to attach.</td>
    </tr>
  </tbody>
</table>

---

## Prompt turn

A **prompt turn** is one cycle from a user message to a final `stopReason` on the same `session/prompt` request. The seller may use an LLM, push `session/update` progress, request permission for tools, and the buyer may cancel mid-turn. Requires init and a **ready** session.

**Prompt content:** Each item in `params.prompt` is a content block with a `type` (for example `text`, `image`, or `resource`). The buyer must only send types the two sides agreed at `initialize` under `promptCapabilities`.

<figure style="text-align:center; margin: 0 0 1.5rem;">
  <img
    src="/assets/images/ACP_Article_assets/prompt-turn.png"
    alt="Prompt turn sequence diagram"
    style="max-width: 820px; width: 100%; height: auto; border-radius: 10px;"
  />
  <figcaption style="font-size: 0.95rem; opacity: 0.8; margin-top: 8px;">
    Figure 4 — Prompt turn. Solid lines = requests; dashed = seller notifications. LLM work is seller-internal.
  </figcaption>
</figure>

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:6%;">Step</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:12%;">Phase</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Buyer-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:26%;">Seller-side agent</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:34%;">Method</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Session ready</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Active session</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Active session</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">1</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Prompt creation</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends user message</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Receives, runs LLM</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/prompt</code></td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">2</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Prompt response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Renders updates</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Streams plan, text, tool calls, permissions</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/update</code></td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">User grants</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends permission response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Requests permission; runs tool if allowed</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/request_permission</code> + response</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">—</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">User denies</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Sends cancel</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Stops LLM and tools; sends cancel response</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/cancel</code> + response</td>
    </tr>
  </tbody>
</table>

#### Wire format

<div class="wire-pair" markdown="1">

<div class="wire-panel" markdown="1">

**Request — `session/prompt`**

```json
{
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc",
    "prompt": [
      {
        "type": "text",
        "text": "Running shoes under $150"
      }
    ]
  }
}
```

**Cancel (notification)**

```json
{
  "method": "session/cancel",
  "params": {
    "sessionId": "sess_abc"
  }
}
```

</div>

<div class="wire-panel" markdown="1">

**Notification — `session/update`**

```json
{
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "…"
      }
    }
  }
}
```

**Turn complete — `stopReason: end_turn`**

```json
{
  "id": 2,
  "result": {
    "stopReason": "end_turn"
  }
}
```

</div>

</div>

<div class="wire-pair" markdown="1">

<div class="wire-panel" markdown="1">

**Turn complete — `stopReason: cancelled`**

```json
{
  "result": {
    "stopReason": "cancelled"
  }
}
```

</div>

<div class="wire-panel" markdown="1">

**Turn complete — `stopReason: needs_clarification`**

```json
{
  "result": {
    "stopReason": "needs_clarification",
    "message": "What is your budget?"
  }
}
```

</div>

</div>

### Key rules — prompt turn

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Rule</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:78%;">Requirement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Order</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Initialize, session ready, then <code>session/prompt</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Content</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Block <code>type</code> must match negotiated <code>promptCapabilities</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Updates</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/update</code> is progress; <code>stopReason</code> closes the turn.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Permission</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Seller may ask; buyer responds before sensitive tools.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Cancel</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Aborts the turn; session may stay open.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Cancel + permission</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">Pending permissions get outcome <code>cancelled</code>.</td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Next message</td>
      <td style="padding:9px 14px; border:1px solid #aaa;">New user input = new <code>session/prompt</code>, same <code>sessionId</code>.</td>
    </tr>
  </tbody>
</table>

Spec: [Prompt turn](https://agentclientprotocol.com/protocol/prompt-turn.md)

---

## Protocol map

<table style="width:100%; border-collapse:collapse; font-size:0.95rem; margin: 1rem 0; table-layout:fixed;">
  <thead>
    <tr>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:22%;">Phase</th>
      <th style="text-align:left; padding:10px 14px; border:1px solid #aaa; width:78%;">Primary methods</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Handshake</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>initialize</code></td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Trust</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>authenticate</code></td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Thread</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/new</code>, <code>session/load</code>, <code>session/resume</code>, <code>session/list</code>, <code>session/close</code></td>
    </tr>
    <tr>
      <td style="padding:9px 14px; border:1px solid #aaa;">Conversation</td>
      <td style="padding:9px 14px; border:1px solid #aaa;"><code>session/prompt</code>, <code>session/update</code>, <code>session/request_permission</code>, <code>session/cancel</code></td>
    </tr>
  </tbody>
</table>

---

## Try the demo

Still struggling to see how the phases connect? Walk through a live, step-by-step visualization: [Agentic Commerce Protocol — Phase 1 Demo](https://dheeraj-acp-demo.netlify.app/).

The demo runs handshake, session, intent, offer, and payment between a buyer-side agent and a seller-side agent. Step through it once, then come back to this post — the sequence diagrams and wire formats should click more easily.

---

## Thank you for reading

**Acknowledgement:** Pratik Ratadiya — thank you for reading the initial draft.
