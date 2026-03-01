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
  Leia isto em: 
  <a href="README.md"><img src="https://flagcdn.com/20x15/us.png" alt="English"> English</a> | 
  <a href="README.es-ES.md"><img src="https://flagcdn.com/20x15/es.png" alt="Español"> Español</a>
</p>

---

Um `community node` do n8n que agrupa múltiplas entradas dentro de uma janela de tempo antes de prosseguir o `workflow`. Ele garante que as conversas pareçam mais naturais e fluidas, consolidando mensagens fragmentadas de usuários em um payload único e coeso antes do processamento.

> **Caso de uso real:** Um usuário envia "Oi", "Tudo bem?" e "Preciso de ajuda com meu pedido" em rápida sucessão. Em vez de processar cada mensagem de forma independente, este `node` aguarda uma breve pausa, agrupando o texto. Isso permite que seu `workflow` responda ao pensamento completo, resultando em uma interação mais dinâmica e natural.

## ✅ Principais Vantagens e Casos de Uso

- **Desempenho nativo:** Zero dependências npm externas. Construído com módulos nativos do Node.js (`net` / `tls`) e protocolo RESP2 puro.
- **Prevenção de `race conditions`:** Utiliza scripts Lua atômicos no Redis para garantir a segurança da execução, mesmo em ambientes de alto rendimento.

**Recursos Avançados de Controle:**
- **`First Message Behavior`**: Especifique regras diferentes para a primeira interação de uma sessão. *Caso de uso:* Envie uma saudação automática imediata quando a primeira mensagem chegar, enquanto aplica o agrupamento `debounce` a todas as mensagens subsequentes.
- **Max Messages**: Force um `flush` imediato após um número definido de mensagens, independentemente do cronômetro de silêncio. *Caso de uso:* Processe lotes com eficiência quando um usuário colar um texto grande dividido em dezenas de mensagens rápidas.
- **Max Wait Time**: Defina um limite rígido de tempo total de espera antes de forçar um `flush`. *Caso de uso:* Garanta que o sistema limite a espera e responda a um usuário longo que não para de digitar, mantendo o engajamento.
- **Flush Keywords**: Defina palavras que disparam um `flush` imediato quando detectadas. *Caso de uso:* Ignore a janela de espera se o usuário digitar comandos prioritários como "urgente", "parar" ou "cancelar".
- **On Duplicate**: Lide de forma sistemática com mensagens consecutivas idênticas (Ignorar, Incluir ou realizar `flush`). *Caso de uso:* Ignore com segurança envios duplos acidentais de um bot ou de um usuário apertando o mesmo botão repetidamente, prevenindo execuções duplicadas.

---

## 🛠 Instalação

Siga o [guia de instalação](https://docs.n8n.io/integrations/community-nodes/installation/) na documentação de n8n community nodes.

---

## ⚙️ Como funciona

Toda vez que uma mensagem chega, o `node`:
1. Armazena a mensagem no Redis usando a chave da sessão.
2. Aguarda pela janela constigurada de `debounce`.
3. Após a espera, verifica se alguma nova mensagem chegou durante esse tempo.
4. Se **nenhuma nova mensagem** chegou → realiza um `flush` emitindo tudo como um único item.
5. Se **uma nova mensagem** chegou → para silenciosamente (a execução mais recente assumirá o controle e fará o `flush` mais tarde).

Quando o `node` ainda está aguardando, **ele não emite nada** — o `workflow` simplesmente para ali. Não há necessidade de nodes IF ou filtros após ele.

---

## 📝 Configuração

### Campos Obrigatórios

| Campo | Descrição |
|---|---|
| **Redis Credential** | Sua conexão Redis configurada nas credenciais do n8n |
| **Session ID** | Identificador único para a conversa (ex.: ID do chat, ID do usuário ou número de telefone) |
| **Message** | O texto de entrada a ser armazenado |
| **Debounce Window** | Segundos a aguardar por silêncio antes de realizar um `flush` (ex.: `10`) |

### Configurações Opcionais

| Configuração | Descrição | Padrão |
|---|---|---|
| **`First Message Behavior`** | Comportamento especial para a primeira mensagem de uma nova sessão: `flush` Imediato ou uma Janela Personalizada. | `None` |
| **Session TTL** | Tempo de inatividade antes que uma sessão seja apagada do Redis. *(Disponível se um `First Message Behavior` estiver configurado)*. | `24 Hours` |
| **Max Messages** | Força um `flush` imediato após N mensagens, independentemente do cronômetro de silêncio. | `0` (Desativado) |
| **Max Wait Time** | Tempo máximo total em segundos antes de forçar um `flush`, mesmo se continuarem chegando mensagens sem silêncio. | `0` (Desativado) |
| **Flush Keywords** | Lista de palavras separadas por `;` que acionam um `flush` imediato quando detectadas na mensagem. | — |
| **On Duplicate Message** | O que fazer quando a mesma mensagem chegar duas vezes seguidas: Ignorar, Incluir ou realizar `flush` imediatamente. | `Include` |
| **Separator** | A string usada para unir múltiplas mensagens durante o `flush`. | `\n` |

> 💡 **Dica Profissional:** Se tanto o `Max Messages` quanto o `Max Wait Time` estiverem definidos, a condição que for atendida primeiro acionará o `flush`.

---

## 📩 Saída

Quando o `debounce` dispara, o `node` emite um único item devidamente estruturado:

```json
{
  "fullMessage": "Oi\nTudo bem?\nPreciso de ajuda com meu pedido",
  "messageCount": 3,
  "flushReason": "debounceWindow"
}
```

### Motivos do Flush:

- `debounceWindow` — janela de silêncio padrão transcorrida.
- `firstMessage` — acionado pela lógica do `First Message Behavior`.
- `maxMessages` — limite máximo de mensagens atingido.
- `maxWaitTime` — limite máximo de tempo de espera atingido.
- `keyword` — uma palavra-chave de `flush` foi detectada.
- `duplicate` — uma mensagem duplicada provocou o `flush`.

---

## 🧑‍💻 Exemplo de `workflow`

```text
Webhook → [Extract Context] → Message Debounce → AI Agent / Switch Node
```

Este `node` simplifica sua infraestrutura ao remover a necessidade de contornos manuais complexos de `debounce` como nodes Wait, bancos de dados externos ou loops de espera. Ele fornece uma lógica robusta e nativa para manter seus `workflows` limpos e diretamente responsivos.

---

## 🤝 Suportado pela U.ai Automação

Desenvolvido pela equipe da **[U.ai Automação](https://uaiautomacao.com)**.

## 📄 Licença

[MIT](LICENSE)

[n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
