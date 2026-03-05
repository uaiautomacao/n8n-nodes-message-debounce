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

<p align="center">
  <a href="https://github.com/uaiautomacao/n8n-nodes-message-debounce"><img src="https://img.shields.io/github/stars/uaiautomacao/n8n-nodes-message-debounce?style=social" alt="GitHub stars"/></a>
</p>

---

An n8n `community node` that groups multiple inputs within a time window before continuing the `workflow`. It ensures conversations feel more natural and fluid by consolidating fragmented user messages into a single, cohesive payload before processing.

> **Real-world use case:** A user sends "Hi", "How are you?", and "I need help with my order" in quick succession. Instead of processing each message independently, this `node` waits for a brief pause, grouping the text. This allows your `workflow` to respond to the complete thought, resulting in a more dynamic and natural interaction.

## ✅ Core Advantages & Use Cases

- **Native performance:** Zero external npm dependencies. Built with native Node.js socket modules (`net` / `tls`) and pure RESP2 protocol.
- **`race conditions` prevention:** Uses atomic Lua scripts in Redis to guarantee execution safety, even in high-throughput environments.

**Advanced Control Features:**
- **`First Message Behavior`**: Specify different rules for the first interaction of a session. *Use case:* Send an immediate automatic greeting when the first message arrives, while applying the `debounce` grouping to all subsequent messages.
- **Max Messages**: Force an immediate `flush` after a set number of messages, regardless of the silence timer. *Use case:* Process batches efficiently when a user pastes a large text split into dozens of rapid messages.
- **Max Wait Time**: Set a hard limit on total wait time before forcing a `flush`. *Use case:* Ensure the system eventually responds to an extremely talkative user who never stops typing, maintaining engagement.
- **Flush Keywords**: Define words that trigger an immediate `flush` when detected. *Use case:* Bypass the wait window if the user types priority commands like "urgent", "stop", or "cancel".
- **On Duplicate**: Handle identical consecutive messages systematically (Ignore, Include, or Flush). *Use case:* Safely ignore accidental double-sends from a bot or a user pushing the same button repeatedly, preventing duplicated executions.

---

## 🛠 Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

---

## ⚙️ How it works

Every time a message arrives, the `node`:
1. Stores the message in Redis under the session's key.
2. Waits for the configured `debounce` Window.
3. After the wait, checks if any new message arrived during that time.
4. If **no new messages** arrived → performs a `flush` outputting everything as a single item.
5. If **a new message** arrived → silently stops (the newer execution will take over and `flush` later).

When the `node` is still waiting, **it emits nothing** — the `workflow` simply stops there. No need for IF nodes or filters after it.

---

## 📝 Configuration

### Required Fields

| Field | Description |
|---|---|
| **Redis Credential** | Your Redis connection configured in n8n credentials |
| **Session ID** | Unique identifier for the conversation (e.g., chat ID, user ID, or phone number) |
| **Message** | The incoming text to be buffered |
| **Debounce Window** | Seconds to wait for silence before performing a `flush` (e.g., `10`) |

### Optional Settings

| Setting | Description | Default |
|---|---|---|
| **`First Message Behavior`** | Special behavior for the first message of a new session: Immediate `flush` or a Custom Window. | `None` |
| **Session TTL** | Inactivity time before a session is erased from Redis. *(Available if a `First Message Behavior` is set)*. | `24 Hours` |
| **Max Messages** | Force an immediate `flush` after N messages, regardless of the silence timer. | `0` (Disabled) |
| **Max Wait Time** | Maximum total seconds before forcing a `flush`, even if messages keep arriving without silence. | `0` (Disabled) |
| **Flush Keywords** | List of words divided by `;` that trigger an immediate `flush` when detected in the message. | — |
| **On Duplicate Message** | What to do when the exact same message arrives twice in a row: Ignore, Include, or `flush` immediately. | `Include` |
| **Separator** | The string used to join multiple messages together when flushing. | `\n` |

> 💡 **Pro Tip:** If both `Max Messages` and `Max Wait Time` are set, whichever condition is met first will trigger the `flush`.

---

## 📩 Output

When the `debounce` fires, the `node` outputs a single cleanly structured item:

```json
{
  "fullMessage": "Hi\nHow are you?\nI need help with my order",
  "messageCount": 3,
  "flushReason": "debounceWindow"
}
```

### Flush Reasons:

- `debounceWindow` — standard silence window elapsed.
- `firstMessage` — triggered by the `First Message Behavior` logic.
- `maxMessages` — maximum message count threshold reached.
- `maxWaitTime` — maximum wait time threshold reached.
- `keyword` — a `flush` keyword was detected in the payload.
- `duplicate` — a duplicate message triggered the `flush`.

---

## 🧑‍💻 Example `workflow`

```text
Webhook → [Extract Context] → Message Debounce → AI Agent / Switch Node
```

This `node` simplifies your infrastructure by removing the need for complex manual `debounce` workarounds like Wait nodes, external databases, or sleep loops. It provides native, reliable logic to keep your `workflows` clean and strictly responsive.

---

## 🤝 Supported by U.ai Automação

Crafted by the team at **[U.ai Automação](https://uaiautomacao.com)**.

If this `node` saved you time, consider giving it a ⭐ on [GitHub](https://github.com/uaiautomacao/n8n-nodes-message-debounce)

## 📄 License

[MIT](LICENSE)

[n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
