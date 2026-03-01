# n8n-nodes-message-debounce

<p align="center">
  <img src="https://uaiautomacao.com/logo.png" alt="U.ai Automação" width="200"/>
</p>

<p align="center">
  <img src="https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png" alt="n8n community node" />
</p>

**Este archivo es la traducción al Español. [Ver el original en Inglés](README.md).**

---

Un **nodo comunitario de n8n** que agrupa múltiples entradas dentro de una ventana de tiempo antes de continuar el flujo — evitando que tu automatización reaccione a cada mensaje aislado antes de que el usuario termine de escribir.

> **Caso de Uso Real:** Un usuario envía "Hola", luego "¿Cómo estás?", y después "Necesito ayuda con mi pedido". Sin debounce (agrupamiento), tu flujo se dispara tres veces innecesariamente. Con este nodo, espera el silencio y procesa todo como un único mensaje consolidado.

## ✅ ¿Por qué usar este nodo?

- **Rendimiento Nativo:** Cero dependencias NPM externas. Construido utilizando solo los sockets puros de Node.js (`net` / `tls`) y el protocolo nativo RESP2.
- **Protección contra Condiciones de Carrera (Race-conditions):** Utiliza scripts Lua atómicos directamente en el servidor Redis para garantizar total seguridad de ejecución, incluso bajo tráfico severo.
- **Listo para Queue Mode:** Totalmente compatible con instancias *worker* de n8n. Solo apunta al mismo Redis que tu n8n ya utiliza.

---

## 🛠 Instalación

Sigue la [guía de instalación](https://docs.n8n.io/integrations/community-nodes/installation/) en la documentación de nodos comunitarios de n8n.

---

## ⚙️ Cómo funciona

Cada vez que llega un mensaje, este nodo:
1. Guarda el mensaje en Redis utilizando la clave de esa sesión.
2. Espera la cantidad de tiempo configurada en la *Debounce Window*.
3. Después del tiempo, comprueba si ha llegado algún otro mensaje en ese intervalo.
4. Si **ningún mensaje** nuevo ha llegado → procesa (flush) todos los mensajes almacenados juntos como un solo texto.
5. Si **un nuevo mensaje** ha llegado → el nodo se detiene silenciosamente (la ejecución más reciente tomará el control y hará el flush al final de su tiempo).

Mientras el nodo esté esperando el silencio, **no emite nada hacia adelante** — tu flujo simplemente se detiene ahí. No necesitas usar nodos IF o filtros después de él.

---

## 📝 Configuración

### Campos Obligatorios

| Campo | Descripción |
|---|---|
| **Redis Credential** | Tu conexión a Redis, configurada desde la pantalla de Credenciales de n8n. |
| **Session ID** | Identificador único para esa conversación (ej: ID de Telegram, Número de WhatsApp, etc). |
| **Message** | El texto del mensaje que está llegando. |
| **Debounce Window** | Cantidad de segundos a esperar por silencio antes de procesar los ítems (ej: `10`). |

### Configuraciones Opcionales

| Campo | Descripción | Por defecto |
|---|---|---|
| **First Message Behavior** | Comportamiento especial para el 1er mensaje de una nueva sesión: Procesar al instante (`Immediate`) o esperar un tiempo menor (`Custom Window`). | `None` |
| **Session TTL** | Tiempo de inactividad antes de que los datos de esta sesión se borren de Redis para ahorrar memoria *(Disponible al activar First Message Behavior).* | `24 Hours` |
| **Max Messages** | Fuerza al nodo a procesar los mensajes tras recibir N mensajes, ignorando el temporizador de silencio. | `0` (Desactivado) |
| **Max Wait Time** | Tiempo máximo (en seg.) para forzar el proceso, útil en caso de que el cliente no deje de enviar mensajes sin intervalo de silencio. | `0` (Desactivado) |
| **Flush Keywords** | Lista de palabras divididas por `;` que fuerzan el fin del agrupamiento inmediatamente si se escriben en medio o al principio del mensaje. | — |
| **On Duplicate Message** | Qué hacer cuando llega un mensaje idéntico al último de forma consecutiva: Ignorar (`Ignore`), Incluir (`Include`) o Procesar todo (`Flush`). | `Include` |
| **Separator** | Separador (un Enter nativamente) usado para unir un mensaje debajo del otro a la hora de salida. | `\n` |

> 💡 **Consejo PRO:** Si ambas opciones `Max Messages` y `Max Wait Time` están activas simultáneamente, la que ocurra primero forzará el flush de los mensajes.

---

## 📩 Salida (Output)

Cuando el agrupamiento (debounce) se dispara, el nodo continúa la automatización devolviendo 1 único ítem formateado y enriquecido:

```json
{
  "fullMessage": "Hola\n¿Cómo estás?\nNecesito ayuda con mi pedido",
  "messageCount": 3,
  "flushReason": "debounceWindow"
}
```

### Tipos de Procesamiento (Flush Reasons):

- `debounceWindow` — ventana de silencio estándar alcanzada con éxito.
- `firstMessage` — disparado por la lógica de Regla del 1er Mensaje.
- `maxMessages` — límite de conteo de mensajes alcanzado.
- `maxWaitTime` — tiempo máximo de retraso absoluto alcanzado.
- `keyword` — se ha detectado una palabra clave de control.
- `duplicate` — un texto duplicado en secuencia procesó la lista.

---

## 🧑‍💻 Ejemplo de Flujo (Flow)

```text
Webhook → [Nodos de Enriquecimiento] → Message Debounce → Agente de IA / Switch Node
```

El nodo encaja en cualquier lugar de tu flujo. Puedes procesar audios de WhatsApp al inicio, convertir documentos a texto, etc — y luego pasar todo a la etapa de agrupamiento. Él se encarga de la fila.

---

## 🤝 Mantenido por U.ai Automação

Creado con extrema dedicación al ecosistema por el equipo de **[U.ai Automação](https://uaiautomacao.com)** — Creando soluciones de automatización robustas para dinámicas del mundo real.

## 📄 Licencia

[MIT](LICENSE)

[n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

