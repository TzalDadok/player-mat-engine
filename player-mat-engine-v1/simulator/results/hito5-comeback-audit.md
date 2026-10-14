# Hito 5 — Auditoría de remontadas en FFA de cuatro jugadores

Muestra: 640 partidas terminadas sobre 40 mapas, cuatro rotaciones de civilizaciones y cuatro órdenes de CU. Perfil de bot: balanced. Configuración de inicio: experimento L.
Se mide una posición durante la partida, sin modificar decisiones. Solo se evalúan rondas que todavía tengan al menos tres jugadores vivos.

## Indicador de ventaja, definido antes de calcular los resultados

Puntaje = 2×fuerza militar + 2×cantidad de unidades militares + 2×aldeanos + 3×edificios + 2×tecnologías + territorios controlados + 0,35×fichas controladas + 0,5×Poder Militar.
Este puntaje es una aproximación de ventaja táctica/económica; no equivale a ventaja objetiva, ni garantiza que el líder vaya a ganar.

## Remontadas observadas

| Ronda | Estados elegibles | Ganó el que estaba último | Ganó el que estaba primero | Ganó quien tenía más fuerza militar | Ganó alguien sin ejército |
|---|---:|---:|---:|---:|---:|
| 8 | 628 | 18.6% | 33.9% | 29.1% | 562 |
| 12 | 612 | 17.8% | 43.0% | 32.7% | 518 |
| 16 | 580 | 17.9% | 54.3% | 51.6% | 372 |
| 20 | 523 | 11.3% | 60.6% | 55.8% | 186 |

## Interpretación
Que gane el último según el puntaje demuestra que existe alguna posibilidad de remontada bajo las estrategias simuladas; no identifica por sí sola la regla causal. Es necesario estudiar secuencias concretas y las ventajas estructurales frente a humanos.
La muestra reutiliza mapas y rotaciones; los porcentajes son descriptivos, no observaciones independientes.

