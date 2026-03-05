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
  Léalo en: 
  <a href="README.md"><img src="https://flagcdn.com/20x15/us.png" alt="English"> English</a> |
  <a href="README.pt-BR.md"><img src="https://flagcdn.com/20x15/br.png" alt="Português do Brasil"> Português (BR)</a>
</p>

<p align="center">
  <a href="https://github.com/uaiautomacao/n8n-nodes-message-debounce"><img src="https://img.shields.io/github/stars/uaiautomacao/n8n-nodes-message-debounce?style=social" alt="GitHub stars"/></a>
</p>

---

Un `community node` de n8n que agrupa múltiples entradas dentro de una ventana de tiempo antes de continuar el `workflow`. Garantiza que las conversaciones resulten más naturales y fluidas al consolidar los mensajes fragmentados de los usuarios en un único payload coherente antes del procesamiento.

> **Caso de uso real:** Un usuario envía "Hola", "¿Qué tal?", y "Necesito ayuda con mi pedido" en rápida sucesión. En lugar de procesar cada mensaje de manera independiente, este `node` espera a que haya una breve pausa, agrupando el texto. Esto permite que el `workflow` responda al pensamiento completo, lo que genera una interacción más dinámica y natural.

## ✅ Principales Ventajas y Casos de Uso

- **Rendimiento nativo:** Cero dependencias npm externas. Construido con módulos socket nativos de Node.js (`net` / `tls`) y protocolo RESP2 puro.
- **Prevención de `race conditions`:** Utiliza scripts Lua atómicos en Redis para garantizar la seguridad de la ejecución, incluso en entornos de gran volumen.

**Características Avanzadas de Control:**
- **`First Message Behavior`**: Especifique reglas diferentes para la primera interacción de una sesión. *Caso de uso:* Envíe un saludo automático inmediato al llegar el primer mensaje, mientras aplica la agrupación `debounce` a todos los mensajes posteriores.
- **Max Messages**: Fuerza un `flush` inmediato al alcanzar una cantidad definida de mensajes, independientemente del temporizador de silencio. *Caso de uso:* Procese lotes de forma eficiente cuando un usuario pega un texto largo dividido en docenas de mensajes rápidos.
- **Max Wait Time**: Define un límite estricto de tiempo total de espera antes de forzar un `flush`. *Caso de uso:* Asegura que el sistema termine respondiendo a un usuario que no para de escribir, manteniendo el nivel de participación.
- **Flush Keywords**: Define palabras que al detectarse desencadenan un `flush` inmediato. *Caso de uso:* Evita la ventana de espera si el usuario escribe comandos prioritarios como "urgente", "detener" o "cancelar".
- **On Duplicate**: Maneja de forma sistemática mensajes consecutivos idénticos (Ignorar, Incluir o realizar `flush`). *Caso de uso:* Ignore de forma segura envíos dobles accidentales de un bot o de un usuario apretando repetidas veces el mismo botón, evitando ejecuciones duplicadas.

---

## 🛠 Instalación

Siga la [guía de instalación](https://docs.n8n.io/integrations/community-nodes/installation/) en la documentación de n8n community nodes.

---

## ⚙️ Cómo funciona

Cada vez que llega un mensaje, el `node`:
1. Almacena el mensaje en Redis bajo la clave de la sesión.
2. Espera durante la ventana configurada de `debounce`.
3. Tras la espera, comprueba si llegó algún mensaje nuevo en ese tiempo.
4. Si **no han llegado nuevos mensajes** → ejecuta un `flush` agrupando todo en una única salida.
5. Si **ha llegado un nuevo mensaje** → se detiene silenciosamente (la ejecución más reciente tomará el control y hará el `flush` más tarde).

Mientras el `node` se encuentra en estado de espera, **no emite nada** — el `workflow` simplemente se detiene ahí. No es necesario añadir nodes IF ni filtros a continuación.

---

## 📝 Configuración

### Campos Obligatorios

| Campo | Descripción |
|---|---|
| **Redis Credential** | Su conexión a Redis configurada en las credenciales de n8n |
| **Session ID** | Identificador único de la conversación (p. ej., ID del chat, del usuario o su número de teléfono) |
| **Message** | El texto entrante que se retendrá |
| **Debounce Window** | Segundos a esperar en silencio antes de realizar un `flush` (p. ej., `10`) |

### Opciones Adicionales

| Ajuste | Descripción | Por defecto |
|---|---|---|
| **`First Message Behavior`** | Comportamiento especial para el primer mensaje de una nueva sesión: un `flush` Inmediato o una Ventana Personalizada. | `None` |
| **Session TTL** | Tiempo de inactividad antes de que la sesión se borre de Redis. *(Disponible si se configura un `First Message Behavior`)*. | `24 Hours` |
| **Max Messages** | Fuerza el `flush` inmediato después de N mensajes, sin importar el temporizador de silencio. | `0` (Desactivado) |
| **Max Wait Time** | Límite de tiempo máximo en segundos para forzar un `flush`, aunque sigan llegando mensajes continuamente. | `0` (Desactivado) |
| **Flush Keywords** | Lista separada por `;` con las palabras que disparan un `flush` inmediato en cuanto se detectan dentro de un mensaje. | — |
| **On Duplicate Message** | Acción a realizar cuando el mismo mensaje ingresa dos veces seguidas: Ignorar, Incluir o realizar `flush` inmediatamente. | `Include` |
| **Separator** | La cadena de texto utilizada para separar y vincular múltiples mensajes durante el `flush`. | `\n` |

> 💡 **Consejo Profesional:** Si configura tanto `Max Messages` como `Max Wait Time`, la condición que se cumpla primero será la que desencadene el `flush`.

---

## 📩 Salida

Cuando se acciona el `debounce`, el `node` produce un único elemento claramente estructurado:

```json
{
  "fullMessage": "Hola\n¿Qué tal?\nNecesito ayuda con mi pedido",
  "messageCount": 3,
  "flushReason": "debounceWindow"
}
```

### Motivos del Flush:

- `debounceWindow` — Ventana convencional de silencio transcurrida.
- `firstMessage` — Detonado según la lógica de `First Message Behavior`.
- `maxMessages` — Se alcanzó el límite máximo de mensajes.
- `maxWaitTime` — Se alcanzó el límite máximo de tiempo de espera.
- `keyword` — Una palabra clave de `flush` fue detectada.
- `duplicate` — Un mensaje se duplicó y provocó el `flush`.

---

## 🧑‍💻 Ejemplo de `workflow`

```text
Webhook → [Extract Context] → Message Debounce → AI Agent / Switch Node
```

Este `node` simplifica su infraestructura eliminando la necesidad de aplicar arreglos manuales complejos para lograr el `debounce`, tales como implementaciones de Wait nodes, bases de datos externas o funciones de bucles de espera. Provee una lógica sólida y nativa que asiste en conservar sus `workflows` limpios y directamente reactivos.

---

## 🤝 Soporte a cargo de U.ai Automação

Elaborado por el equipo oficial en **[U.ai Automação](https://uaiautomacao.com)**.

Si este `node` te ahorró tiempo, considera darle una ⭐ en [GitHub](https://github.com/uaiautomacao/n8n-nodes-message-debounce)

## 📄 Licencia

[MIT](LICENSE)

[n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
