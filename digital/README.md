# AoE BoardGame Digital — Hito 1 · Cloudflare

Proyecto web independiente de los Player Mats físicos.

## Arquitectura
- **Phaser 3:** cliente gráfico adaptable a pantalla completa.
- **Cloudflare Worker:** sirve la misma web en HTTPS y enruta WebSockets `/ws/:sala`.
- **Durable Object GameRoom:** salas de hasta 4 jugadores, presencia y mensajes básicos, mediante WebSocket Hibernation.
- **Un solo dominio** `https://aoe-boardgame-digital.<subdominio>.workers.dev` para web y backend. La dirección se asignará al desplegar.
- No hay bots, motor de reglas, generación procedural ni recuperación de plazas tras desconexión todavía.

## Deploy directamente desde GitHub
1. Crear cuenta en Cloudflare y conectar el repo `TzalDadok/player-mat-engine` desde **Workers & Pages → Create application → GitHub**.
2. Seleccionar la rama `main` y **Worker name `aoe-boardgame-digital`** (debe coincidir con `wrangler.jsonc`).
3. En **Root directory** colocar `digital`.
4. Configurar **Build command**: `npm run build`.
5. Configurar **Deploy command**: `npx wrangler deploy`.
6. Publicar. Cloudflare asignará una URL `.workers.dev`. Se publicarán los cambios posteriores al conectar GitHub.
7. Para jugar, abrir la URL, elegir un nombre y escribir **el mismo código de sala** que los otros jugadores. Se puede compartir `?sala=PRUEBA1`.

La creación del Worker y la autorización de GitHub requieren acción del dueño de la cuenta Cloudflare. No hay que abrir puertos ni encender un servidor de casa.

## Desarrollo local
Requiere Node.js 22+ y npm:
```bash
cd digital
npm install
npm run dev
```
El comando construye los assets y ejecuta Wrangler localmente; ver la URL local que imprima Wrangler.

## Validación
```bash
npm run check
npm run build
```
Hito 1 preparado en GitHub; hasta desplegarlo falta validar en Cloudflare el build y dos jugadores conectados.

## Hito 2
Mapa procedural visible con **18 hexágonos por jugador** (10 primarios y 8 secundarios; dos por tipo). **Los CU se colocan después** por los jugadores, como piezas nuevas adyacentes al perímetro del mapa generado.
