# n8n-nodes-message-debounce


<p align="center">
  <img src="https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png" alt="n8n community node" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/n8n-nodes-message-debounce"><img src="https://img.shields.io/npm/v/n8n-nodes-message-debounce.svg?style=flat-square" alt="npm version"/></a>
  <a href="https://www.npmjs.com/package/n8n-nodes-message-debounce"><img src="https://img.shields.io/npm/dm/n8n-nodes-message-debounce.svg?style=flat-square" alt="npm downloads"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT"/></a>
  <a href="https://uaiautomacao.com"><img src="https://img.shields.io/badge/by-U.ai%20Automa%C3%A7%C3%A3o-blue?style=flat-square" alt="by U.ai Automação"/></a>
</p>

<p align="center">
  Read this in: 
  <a href="README.pt-BR.md"><img src="https://flagcdn.com/20x15/br.png" alt="Português do Brasil"> Português (BR)</a> | 
  <a href="README.es-ES.md"><img src="https://flagcdn.com/20x15/es.png" alt="Español"> Español</a>
</p>

---

An n8n community node that groups multiple inputs within a time window before continuing the flow — preventing your automation from reacting to every single message before the user finishes writing.

> **Real-world use case:** A user sends "Hi", then "How are you?", then "I need help with my order". Without debounce, your flow fires three times unnecessarily. With this node, it waits for silence and processes everything as one consolidated message.

## ✅ Why use this node?

- **Native performance:** Zero external npm dependencies. Built with pure Node.js sockets (`net` / `tls`) and pure RESP2 protocol.
- **Race-condition safe:** Uses atomic Lua scripts in Redis to guarantee execution safety, even in high-throughput environments.
- **Queue Mode ready:** Fully compatible with n8n worker instances. Just point to the same Redis instance your n8n uses.

---

## 🛠 Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

---

## ⚙️ How it works

Every time a message arrives, the node:
1. Stores the message in Redis under the session's key.
2. Waits for the configured *Debounce Window*.
3. After the wait, checks if any new message arrived during that time.
4. If **no new messages** arrived → flushes everything as a single output.
5. If **a new message** arrived → silently stops (the newer execution will take over and flush later).

When the node is still waiting, **it emits nothing** — the flow simply stops there. No need for IF nodes or filters after it.

---

## 📝 Configuration

### Required Fields

| Field | Description |
|---|---|
| **Redis Credential** | Your Redis connection configured in n8n credentials |
| **Session ID** | Unique identifier for the conversation (e.g., chat ID, user ID, or phone number) |
| **Message** | The incoming text to be buffered |
| **Debounce Window** | Seconds to wait for silence before flushing the messages out (e.g. `10`) |

### Optional Settings

| Setting | Description | Default |
|---|---|---|
| **First Message Behavior** | Special behavior for the first message of a new session: `Immediate` flush or a `Custom Window`. | `None` |
| **Session TTL** | Inactivity time before a session is erased from Redis to save memory. *(Available if a First Message Behavior is set)*. | `24 Hours` |
| **Max Messages** | Force an immediate flush after N messages, regardless of the silence timer. | `0` (Disabled) |
| **Max Wait Time** | Maximum total seconds before forcing a flush, even if messages keep arriving without silence. | `0` (Disabled) |
| **Flush Keywords** | List of words divided by `;` that trigger an immediate flush when detected in the message. | — |
| **On Duplicate Message** | What to do when the exact same message arrives twice in a row: `Ignore`, `Include`, or `Flush` immediately. | `Include` |
| **Separator** | The string used to join multiple messages together when flushing. | `\n` |

> 💡 **Pro Tip:** If both `Max Messages` and `Max Wait Time` are set, whichever condition is met first will trigger the flush.

---

## 📩 Output

When the debounce fires, the node outputs a single cleanly structured item:

```json
{
  "fullMessage": "Hi\nHow are you?\nI need help with my order",
  "messageCount": 3,
  "flushReason": "debounceWindow"
}
```

### Flush Reasons:

- `debounceWindow` — standard silence window elapsed.
- `firstMessage` — triggered by the First Message Behavior logic.
- `maxMessages` — maximum message count threshold reached.
- `maxWaitTime` — maximum wait time threshold reached.
- `keyword` — a flush keyword was detected in the payload.
- `duplicate` — a duplicate message triggered the flush.

---

## 🧑‍💻 Example Flow

```text
Webhook → [Extract Context] → Message Debounce → AI Agent / Switch Node
```

This node makes your life easier by completely replacing the need for complex manual debounce workarounds (like using Wait nodes, extra databases, or sleep loops). It already features native, reliable logic—including dedicated First Message behaviors—to keep your workflows clean and responsive.

---

## 🤝 Supported by U.ai Automação

Crafted with care by the team at **[U.ai Automação](https://uaiautomacao.com)** — Building robust automation solutions for real-world workflows.

## 📄 License

[MIT](LICENSE)

[n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

