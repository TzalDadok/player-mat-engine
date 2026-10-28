# AoE BoardGame Digital — Hito 3

Partida multijugador de 2 a 4 personas con mapa hexagonal, preparación,
colocación de Centros Urbanos y primeras acciones jugables por turnos.

## Arquitectura

- **Phaser 3:** tablero, texturas WebP, interacción por mouse y pantalla táctil.
- **Cloudflare Worker + Durable Object GameRoom:** servidor autoritativo de sala,
  validación de reglas, WebSocket y estado persistente.
- **Navegador:** el identificador privado por sala se guarda en `localStorage`.
  El panel de recuperación permite copiarlo y usarlo desde otro dispositivo.
- Todas las acciones del juego se envían por WebSocket, se validan en el
  servidor y se retransmiten a todos los jugadores.

## Cómo jugar

1. Abrí el juego y creá una sala con código único.
2. El anfitrión elige 2–4 participantes y genera el tablero.
3. Cada participante elige una civilización no repetida y marca **Ready**.
   Solo el anfitrión modifica el orden y puede iniciar.
4. Los jugadores colocan y confirman sus CU en el orden elegido.
5. Al confirmar el último CU, se crean automáticamente aldeanos, Poder Militar
   y estado inicial; el jugador primero inicia la ronda.
6. Cada turno tiene una acción **económica**, una **tecnológica** y una **militar**,
   en ese orden. Se puede pasar cualquier fase.

### Tamaño del mapa

- 2 jugadores: 18 terrenos (1 set) y Maravilla central.
- 3–4 jugadores: 36 terrenos (2 sets) y Maravilla central.
- Los CU se colocan fuera del perímetro, como piezas adicionales.

## Reglas implementadas

**Economía:** Producir (2/3/3/4 hexágonos según la Edad),
mover hasta dos aldeanos agrupados, construir, entrenar varios aldeanos
y comerciar hasta dos recursos con un Mercado de precios compartidos.
Los recursos se almacenan en el hexágono productor y solo son gastables
si se controla ese hexágono, sin red logística. Carretilla habilita
transportar recursos durante un movimiento.

**Producción:** Aldeano +1, Campamento Productivo +2, ambos +3;
granja +2 comida por pareja granja/aldeano (máx. 2);
pesca desde costa y bonificación Doble Filo al bosque.

**Construcción:** Campamento Productivo, Granja, Cuartel, Torre y Puerto,
con costes de los Player Mats y restricciones del terreno.

**Tecnología básica:** Telar, Carretilla y Doble Filo (una por acción),
avance de Edad con costes y restricciones.
El combate completo, tropas militares, tecnologías únicas
y condiciones de victoria corresponden a hitos posteriores.

**Inicio:** para cuatro jugadores, orden 1.º/2.º/3.º/4.º
recibe 1/1/2/2 aldeanos y Poder Militar 1/0/0/1. Para 2–3,
la asignación provisional es un aldeano por jugador y PM 0;
requiere confirmación de balance del reglamento.

## Verificación

En GitHub Actions, el flujo
[`Digital - validar Hito 3`](https://github.com/TzalDadok/player-mat-engine/actions)
ejecuta:

```bash
cd digital
npm install
npm run check
npm run build
node tests/hito3-smoke.mjs
```

Las pruebas de integración levantan un Wrangler local y verifican salas
de 2, 3 y 4 jugadores, inicio, civilizaciones, Ready, CU, fases,
producción, validaciones del servidor y reconexión con persistencia.

Los tests locales no reemplazan la prueba visual en teléfonos reales
ni la verificación del despliegue de Cloudflare.

## Desarrollo y publicación

Requiere Node.js 22+.

```bash
cd digital
npm install
npm run dev
```

Para publicar en Cloudflare Workers: conectar el repositorio
`TzalDadok/player-mat-engine`, con directorio raíz `digital`,
comando de build `npm run build` y comando de deploy
`npx wrangler deploy`.

La publicación efectiva depende de la configuración de la cuenta Cloudflare.

## Archivos principales

- `worker/src/index.ts` — estado persistente, validación y acciones.
- `client/src/main.ts` — interfaz, tablero y HUD.
- `client/src/style.css` — diseño adaptable.
- `tests/hito3-smoke.mjs` — tests reales con WebSocket y Wrangler local.
- `client/public/terrenos/` — texturas del tablero.
