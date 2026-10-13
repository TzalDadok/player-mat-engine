# Hito 3 — Simulación masiva y balance

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
