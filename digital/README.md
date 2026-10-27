# AoE BoardGame · Digital — Hito 1

Proyecto nuevo e independiente de los **Player Mats** y del reglamento existentes.

## Objetivo del hito
- Cliente 2D de navegador con Phaser 3, escalado responsivo y botón de pantalla completa.
- Servidor Node.js/Colyseus con una sala básica para hasta **4 conexiones**.
- Lista de jugadores conectados, nombre e indicador de conexión.
- **Sin bots, sin simulaciones heredadas y sin lógica de partida todavía.**
- Hexágonos de la portada: **solo ilustrativos**. La generación procedural real comienza en Hito 2.

## Requisitos
Node.js 22 o superior y npm.

## Ejecutar en desarrollo
```bash
cd digital
npm install
npm run dev
```

Visitar **http://localhost:5173**. El servidor de salas escucha en **ws://localhost:2567**.

Abrí el juego en dos ventanas o navegadores y pulsá **Entrar a sala** para ver usuarios simultáneos.

## Servidor remoto
Para probar desde otra computadora o por Internet, desplegar el proceso Node en un servidor accesible y configurar:

```
# digital/client/.env.local
VITE_GAME_SERVER=wss://servidor-del-juego.example
```

La web debe servirse con HTTPS y usar WSS en producción. GitHub Pages, por sí solo, **no aloja un servidor WebSocket**.

```bash
npm run check
npm run build
```

## Próximos hitos
- Hito 2: generador procedural sobre **18 terrenos por jugador** (10 primarios + 8 secundarios), mapa completamente visible.
- Posteriormente: colocar CU en un **hexágono nuevo exterior, adyacente al mapa ya generado**, por orden de jugadores.
- Hito 3: salas privadas con invitación y sincronización del mapa. El lobby actual es una prueba técnica básica, no aún un sistema de partidas privadas.

## Estructura
- `client/`: Phaser, UI, fullscreen, cliente de red.
- `server/`: Colyseus y validación de salas.
- `shared/` se agregará al comenzar la lógica de reglas compartidas.
