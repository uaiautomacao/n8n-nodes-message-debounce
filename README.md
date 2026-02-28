# n8n-nodes-message-debounce

<p align="center">
  <img src="https://uaiautomacao.com/logo.png" alt="U.ai Automação" width="200"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/n8n-nodes-message-debounce"><img src="https://img.shields.io/npm/v/n8n-nodes-message-debounce.svg" alt="npm version"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
  <a href="https://uaiautomacao.com"><img src="https://img.shields.io/badge/by-U.ai%20Automa%C3%A7%C3%A3o-blue" alt="by U.ai Automação"/></a>
</p>

---

An n8n community node that groups multiple inputs within a time window before continuing the flow — preventing your automation from reacting to every single message before the user finishes writing.

> **Real-world use case:** A user sends "hi", then "how are you", then "I need help with my order". Without debounce, your flow fires three times. With this node, it waits for silence and processes everything as one consolidated message.

---

## How it works

Every time a message arrives, the node:

1. Stores the message in Redis under the session's key
2. Waits for the configured debounce window
3. After the wait, checks if any new message arrived during that time
4. If no new messages arrived → flushes everything as a single output
5. If a new message arrived → silently stops (the newer execution will take over)

When the node is still waiting, **it emits nothing** — the flow simply stops there. No need for IF nodes or filters after it.

---

## Installation

In your n8n instance, go to **Settings → Community Nodes** and install:

```
n8n-nodes-message-debounce
```

> **Requirement:** A Redis instance must be accessible from your n8n environment. In production (queue mode), Redis is already required by n8n — so no extra setup needed.

---

## Configuration

### Required fields

| Field | Description |
|---|---|
| **Redis Credential** | Your Redis connection configured in n8n credentials |
| **Session ID** | Unique identifier for the conversation or session (e.g. chat ID, user ID) |
| **Message** | The content of the incoming message |
| **Debounce Window** | Seconds to wait for silence before flushing (e.g. `10`) |

### Options

| Option | Description | Default |
|---|---|---|
| **Max Messages** | Force flush after N messages, regardless of the timer | — |
| **Max Wait Time** | Maximum total seconds before forcing flush, even if messages keep arriving | — |
| **Flush Keywords** | List of words that trigger an immediate flush when detected in the message | — |
| **On Duplicate Message** | What to do when the same message arrives twice: `ignore`, `include`, or `flush` | `include` |
| **First Message Behavior** | Special behavior for the first message of a new session: `immediate` flush or `customWindow` with a shorter timer | — |
| **Session TTL** | Seconds of inactivity before a session is considered expired (child of First Message Behavior). Set to `never` to keep sessions permanently. | — |
| **Separator** | String used to join multiple messages | `\n` |

> ⚠️ **Memory warning:** If Session TTL is set to `never expire`, sessions will accumulate in Redis indefinitely. Monitor your Redis memory usage.

> 💡 **Max Messages + Max Wait Time:** If both are set, whichever condition is met first triggers the flush.

---

## Output

When the debounce fires, the node outputs a single item:

```json
{
  "fullMessage": "hi\nhow are you\nI need help with my order",
  "messageCount": 3,
  "flushReason": "debounceWindow"
}
```

### flushReason values

| Value | Meaning |
|---|---|
| `debounceWindow` | Silence window elapsed normally |
| `maxMessages` | Max message count reached |
| `maxWaitTime` | Max wait time reached |
| `keyword` | A flush keyword was detected |
| `firstMessage` | First message of a new session with immediate flush configured |
| `duplicate` | Duplicate message triggered flush |

---

## Example flow

```
Webhook → [your processing nodes] → Message Debounce → AI Agent
```

The node fits anywhere in your flow. Process audio transcriptions, extract documents, enrich data — then pass everything into the debounce node. It handles the rest.

---

## Error handling

The node throws explicit errors in the following situations:

- **`Debounce Window is required`** — field left empty
- **`Session ID is required`** — field left empty
- **`Message is required`** — field left empty
- **`Redis connection failed: <detail>`** — could not connect to Redis
- **`Redis operation failed: <detail>`** — an operation failed during execution

Errors are always explicit and descriptive — never silent.

---

## Technical notes

- All Redis operations use atomic Lua scripts to prevent race conditions in high-concurrency scenarios
- Messages are tracked by unique ID, not by content — so duplicate messages are handled correctly
- When suppressed (not the last message), the node emits **no items** and the flow stops cleanly

---

## About

Built by **[U.ai Automação](https://uaiautomacao.com)** — automation solutions for real-world workflows.

---

## License

[MIT](LICENSE)
