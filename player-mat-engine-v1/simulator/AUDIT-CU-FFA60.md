# Auditoría FFA60 — prioridad de CU y bots

## Estado
Se inspeccionaron `maps/ffa36.js`, `bots/baseline.js`, `engine/hex.js` y la conexión de `runner/simulate.js` con el setup FFA. **No se consideran demostradas las causas de los porcentajes de victoria; no cambiar reglas por esos porcentajes.**

## Problemas concretos

1. **La calidad inicial se mide alrededor del ancla, no del CU real.** `scoreFFAStartAnchor` obtiene `startArea(map,anchor)`, distancia <=2 a un terreno del borde. La unidad inicial aparece en `cuHexId`, situado fuera del mapa. Por eso el score no mide literalmente las distancias ni accesibilidad desde la casilla inicial real. El bonus `hasPermanentLandPathToWonder` también arranca desde el ancla; no modela la llegada desde el CU. El score es una heurística, no una garantía de ventaja.
2. **La heurística de elección es codiciosa y puede sesgar el setup.** `autoPlaceFFAPlayerCUs` elige secuencialmente el candidato con máximo score actual. Penaliza proximidad a anclas previamente elegidas, no evalúa simultáneamente las cuatro posiciones ni optimiza equidad. La calidad decreciente por prioridad está parcialmente inducida por este algoritmo.
3. **El bot militar decide a quién atacar usando un ranking geográfico.** `BaselineBot.enemyTargets` minimiza `(path.length * 2) + armyForce + buildings * 0.5`. Eso genera un posible efecto de posición y de foco de ataques que no está incluido en el score de inicio. El desempate consume aleatoriedad del bot.
4. **Riesgo de sesgo por orden de hexágonos:** `strategicLandPath` itera `game.state.hexes` para BFS y elige primero un camino empatado por orden de almacenamiento. Es determinista pero puede favorecer rutas direccionales dependiendo del orden de colocación aleatoria.
5. **El experimento de 3 aldeanos no cambió una sola variable.** Para alojar 2 aldeanos en terrenos distintos, se añadió `minAdjacentLand=2` en la selección de CU. Esto altera el conjunto de anclas elegibles. Se necesita control de 1 aldeano con exactamente la misma restricción geométrica, o modificar la propuesta de colocación de aldeanos.
6. **Muestras correlacionadas.** Las 160 partidas por variante provienen de solo 10 seeds de mapa, repetidas con perfiles y rotaciones; no son 160 mapas independientes. Hace falta comprobar robustez por mapa y por asiento/prioridad con rotaciones de CU equilibradas.

## Pruebas requeridas antes de balancear

- Validación geométrica: todos los CU tienen vecinos permitidos; aldeanos exteriores en terrenos distintos, terrestres y adyacentes; no sobreposición con rivales.
- Emparejar partidas entre 1 y 3 aldeanos conservando las **mismas posiciones de CU** y `minAdjacentLand=2` en ambas variantes.
- Desacoplar prioridad de asiento con rotaciones de orden de CU por seed y reportar tasa por prioridad real.
- Informar por seed: cuatro CU, score real desde el CU, distancia terrestre mínima hasta cada adversario, recursos accesibles y quién ataca primero a quién.
- Repetir con 40 seeds y reportar sensibilidad de resultados por seed. No usar solo win rate agregado para inferir defecto del reglamento.
- Si persiste el segundo elector sistemáticamente débil, testear un bot con objetivo neutral (mismos objetivos por distancia y sin ranking por edificios/fuerza) como prueba de sensibilidad, **sin reemplazar el bot oficial**.

## Alcance

Este documento es una **auditoría estática y metodológica**, no un nuevo experimento ejecutado. La asociación entre la prioridad 2.ª y la baja victoria está observada; su causa exacta aún no está demostrada.
