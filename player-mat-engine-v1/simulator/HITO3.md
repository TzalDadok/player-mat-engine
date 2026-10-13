# Hito 3 — Simulación masiva y balance

**Estado: en curso.**

## Objetivo

Usar los bots cerrados en Hito 2 para producir evidencia de balance mediante partidas reproducibles y comparables.

## Ya construido

- `runner/simulate.js`: partidas headless.
- `runner/benchmark-seeds.js`: conjunto fijo de mapas.
- `runner/benchmark.mjs`: FFA con rotación de asientos y perfiles.
- `runner/duel-benchmark.mjs`: enfrentamientos controlados entre pares de civilizaciones.
- Exportación JSON y Markdown.
- Métricas de hitos:
  - primer Cuartel;
  - primera unidad militar;
  - primera tecnología;
  - primer combate;
  - primer ataque;
  - primera eliminación;
  - Feudal;
  - Castillos;
  - Imperial.
- Diagnóstico de partidas no terminadas.

## Trabajo propio de Hito 3

1. Escalar a cientos y miles de partidas.
2. Construir una matriz completa de matchups.
3. Medir sesgo por asiento.
4. Medir resultados por perfil de bot.
5. Comparar cambios A/B sobre exactamente las mismas seeds.
6. Agregar intervalos de confianza.
7. Separar señales robustas de ruido estadístico.
8. Generar recomendaciones de balance basadas en varias métricas, no sólo win rate.

## Regla metodológica

No se modifica un coste o habilidad sólo porque una muestra pequeña muestre una diferencia de victorias.

Antes de recomendar cambios hay que revisar:

- tasa de finalización;
- cantidad de partidas;
- posición inicial;
- perfil;
- matchup;
- tiempos de desarrollo;
- cantidad de tropas;
- frecuencia de combate;
- reglas provisionales o pendientes.


## Generación del mapa FFA

El benchmark debe conservar el setup físico:

- cuatro reservas personales de terreno;
- dos copias de cada tipo Primario y Secundario por jugador;
- pilas Primario/Secundario barajadas por separado;
- alternancia propia P/S según el asiento;
- tres gradas: 6 + 12 + 18;
- robo aleatorio de la ficha correspondiente;
- elección de posición dentro de la grada;
- descarte de sobrantes;
- elección posterior de CU exterior con distancia mínima 2.

Para experimentos de menos de cuatro jugadores se permiten constructores virtuales de mapa exclusivamente como convención de laboratorio.


## Baseline Hito 3

La baseline de Hito 3 usa:

- mapa físico `ffa36`;
- cuatro rotaciones de asiento por seed;
- cuatro perfiles de bot;
- win rate calculado sólo sobre partidas completadas;
- partidas incompletas reportadas por separado;
- intervalos Wilson del 95%;
- métricas por civilización y por asiento;
- matriz civilización × asiento;
- calidad estimada del arranque;
- métricas de combate;
- revisión/commit guardada en cada artefacto.

El benchmark automático de cada cambio relevante usa 10 seeds:
**10 × 4 rotaciones × 4 perfiles = 160 partidas**.

El workflow manual admite las 40 seeds fijas:
**40 × 4 × 4 = 640 partidas**.

## Comparaciones A/B

`runner/compare-benchmarks.mjs` compara dos artefactos de benchmark emparejando:

- seed;
- perfil;
- rotación de asiento.

Los cambios de win rate se calculan sólo sobre pares que terminaron en ambas versiones. También se registran victorias ganadas/perdidas por civilización y cambios de ganador.

La regla para balancear es: **mismo escenario antes y después del cambio**.


## Experimento B — Orden inverso de CU

Se comparó la baseline `P1 → P2 → P3 → P4` contra `P4 → P3 → P2 → P1`, con 160 partidas por variante.

Resultado principal:

- P4: 8.1% → 26.9%;
- P1: 30.6% → 11.3%;
- P2: 23.8% → 28.7%;
- P3: 37.5% → 33.1%.

Conclusión: el orden de elección de CU explica una parte importante del sesgo, pero invertirlo sólo desplaza la desventaja. No se adopta como regla definitiva por ahora.

Ver `results/hito3-experiment-b-cu-order.md`.


## Experimento C — Prioridad de CU desacoplada

Se mantuvo el orden de turno P1 → P2 → P3 → P4, pero cada asiento ocupó exactamente la misma cantidad de veces las cuatro prioridades de elección de CU.

640 partidas, 100% completadas.

Resultado por asiento:

- P1: 27.3%;
- P2: 23.8%;
- P3: 25.3%;
- P4: 23.6%.

El rango entre mejor y peor asiento cayó de **29.4 pp** en la baseline a **3.8 pp**.

Resultado por prioridad de CU:

- 1.º: 32.8%;
- 2.º: 26.3%;
- 3.º: 32.5%;
- 4.º: 8.4%.

Conclusión: el sesgo original es principalmente de **prioridad de elección de CU**, no de orden de turno. Sin embargo, sortear la prioridad no elimina la desventaja del jugador que elige cuarto en una partida concreta.

Ver `results/hito3-experiment-c-balanced-cu-priority.md`.
