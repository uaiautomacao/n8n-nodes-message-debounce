# n8n-nodes-message-debounce


<p align="center">
  <img src="https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png" alt="n8n community node" />
</p>

**Este arquivo é a tradução em Português do Brasil. [Ver o original em Inglês](README.md).**

---

Um **nó comunitário do n8n** que agrupa múltiplas entradas dentro de uma janela de tempo antes de continuar o fluxo — evitando que sua automação reaja a cada mensagem isolada antes do usuário terminar de escrever.

> **Caso de Uso Real:** Um usuário envia "Oi", depois "Tudo bem?", e depois "Preciso de ajuda com meu pedido". Sem o debounce (agrupamento), seu fluxo dispara três vezes desnecessariamente. Com este nó, ele aguarda o silêncio e processa tudo como uma única mensagem consolidada.

## ✅ Por que usar este nó?

- **Performance Nativa:** Zero dependências NPM externas. Construído utilizando apenas os sockets puros do Node.js (`net` / `tls`) e o protocolo nativo RESP2.
- **Proteção contra Condições de Corrida (Race-conditions):** Utiliza scripts Lua atômicos direto no servidor Redis para garantir total segurança de execução, até sob tráfego severo.
- **Pronto para Queue Mode:** Totalmente compatível com instâncias *worker* do n8n. Basta apontar para o mesmo Redis que o seu n8n já utiliza.

---

## 🛠 Instalação

Siga o [guia de instalação](https://docs.n8n.io/integrations/community-nodes/installation/) na documentação de nós comunitários do n8n.

---

## ⚙️ Como funciona

Toda vez que uma mensagem chega, este nó:
1. Salva a mensagem no Redis utilizando a chave daquela sessão.
2. Aguarda a quantidade de tempo configurada na *Debounce Window*.
3. Após o tempo, checa se mais alguma mensagem chegou naquele intervalo.
4. Se **nenhuma mensagem** nova chegou → ele descarrega (flush) todas as mensagens armazenadas juntas como um texto só.
5. Se **uma nova mensagem** chegou → o nó para silenciosamente (a execução mais recente tomará a posse e fará o flush ao final do tempo dela).

Enquanto o nó estiver aguardando pelo silêncio, **ele não emite nada para a frente** — o seu fluxo simplesmente para ali. Você não precisa usar nós IF ou de filtros depois dele.

---

## 📝 Configuração

### Campos Obrigatórios

| Campo | Descrição |
|---|---|
| **Redis Credential** | Sua conexão com o Redis, configurada pela tela de Credenciais do n8n. |
| **Session ID** | Identificador único para aquela conversa (ex: ID do Telegram, Número do WhatsApp, etc). |
| **Message** | O texto da mensagem que está chegando. |
| **Debounce Window** | Qtd. de segundos para aguardar por silêncio antes de descarregar os itens (ex: `10`). |

### Configurações Opcionais

| Campo | Descrição | Padrão |
|---|---|---|
| **First Message Behavior** | Comportamento especial para a 1ª mensagem de uma nova sessão: Descarregar na hora (`Immediate`) ou aguardar um tempo menor (`Custom Window`). | `None` |
| **Session TTL** | Tempo de inatividade antes que os dados dessa sessão sejam apagados do Redis para economizar memória *(Liberado ativando o First Message Behavior).* | `24 Hours` |
| **Max Messages** | Força o nó a descarregar as mensagens após receber N mensagens, ignorando o timer de silêncio. | `0` (Desativado) |
| **Max Wait Time** | Tempo máximo (em seg.) para forçar a descarga, útil caso o cliente não pare de mandar mensagens sem dar intervalo de silêncio. | `0` (Desativado) |
| **Flush Keywords** | Lista de palavras divididas por `;` que forçam o término do agrupamento imediatamente se digitadas no meio ou começo da mensagem. | — |
| **On Duplicate Message** | O que fazer quando uma mensagem idêntica à última chega consecutivamente: Ignorar (`Ignore`), Incluir (`Include`) ou Descarregar tudo (`Flush`). | `Include` |
| **Separator** | Separador (um Enter nativamente) usado para emendar uma mensagem embaixo da outra na hora da saída. | `\n` |

> 💡 **Dica PRO:** Se ambas opções `Max Messages` e `Max Wait Time` estiverem ativas simultaneamente, quem ocorrer primeiro forçará o flush das mensagens.

---

## 📩 Saída (Output)

Quando o agrupamento (debounce) dispara, o nó prossegue a automação retornando 1 único item formatado e enriquecido:

```json
{
  "fullMessage": "Oi\nTudo bem?\nPreciso de ajuda com meu pedido",
  "messageCount": 3,
  "flushReason": "debounceWindow"
}
```

### Tipos de Descarregamento (Flush Reasons):

- `debounceWindow` — janela de silêncio padrão foi atingida com sucesso.
- `firstMessage` — disparado pela lógica de Regra da 1ª Mensagem.
- `maxMessages` — limite de contagem de mensagens atingido.
- `maxWaitTime` — tempo máximo de atraso absoluto atingido.
- `keyword` — uma palavra-chave de controle foi detectada.
- `duplicate` — um texto duplicado em sequência descarregou a lista.

---

## 🧑‍💻 Exemplo de Fluxo (Flow)

```text
Webhook → [Nós de Enriquecimento] → Message Debounce → Agente de IA / Switch Node
```

Este nó agiliza imensamente a sua vida. Ele evita que você precise criar gambiarras longas e complexas ou usar dezenas de nós auxiliares para tentar fazer um debounce manual. As regras de agrupamento silencioso e comportamento focado na *Primeira Mensagem* já vêm todas embutidas e prontas para rodar.

---

## 🤝 Mantido por U.ai Automação

Criado com dedicação extrema ao ecossistema pelo time da **[U.ai Automação](https://uaiautomacao.com)** — Criando soluções de automação robustas para dinâmicas do mundo real.

## 📄 Licença

[MIT](LICENSE)

[n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

