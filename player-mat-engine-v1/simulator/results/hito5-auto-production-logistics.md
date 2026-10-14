# Hito 5 — Prueba secuencial de producción automática y red logística

Muestra: 10 mapas de 60 hexágonos, cuatro rotaciones y cuatro órdenes de elección por mapa; 480 ejecuciones (perfil balanced). Todas conservan los beneficios iniciales del Experimento L.
Variantes: **Actual**; **Automática** (producción al comenzar cada turno y se libera la acción económica); **Automática + Red** (además, las tecnologías, edades y aldeanos solo pueden pagarse con recursos en una cadena continua de territorios controlados hasta el CU).
La producción automática reutiliza las reglas de PRODUCIR, incluyendo agotamiento y bonificaciones, hasta el límite de hexágonos por edad y solo en hexágonos con productores. El bot decide qué hexágonos produce.
Limitación: los gastos locales de edificios/unidades siguen exigiendo los recursos en el mismo hexágono. La red solo modifica pago remoto controlado, no crea teletransporte ni transporte nuevo.

## Partidas y economía

| Variante | Terminadas | Rondas promedio | Combates promedio | Recursos producidos | Recursos gastados | Jugadores en Feudal+ al final |
|---|---:|---:|---:|---:|---:|---:|
| actual | 160/160 | 33.20 | 1.33 | 65.08 | 40.58 | 0.04 |
| automatica | 139/160 | 33.28 | 0.86 | 104.42 | 29.17 | 0.09 |
| automatica_red | 153/160 | 31.14 | 0.90 | 82.25 | 27.32 | 0.01 |

## Remontadas (último en la ronda 12 o 20 que acaba ganador)

| Variante | R12 casos elegibles | R12 remontadas | R20 casos elegibles | R20 remontadas |
|---|---:|---:|---:|---:|
| actual | 160 | 15.00% | 136 | 6.62% |
| automatica | 139 | 18.71% | 105 | 3.81% |
| automatica_red | 153 | 20.26% | 111 | 2.70% |

Interpretación: los resultados comparan el comportamiento de un perfil de bot concreto, no demuestran balance entre jugadores humanos. El indicador de último usa una puntuación compuesta de ejército, aldeanos, edificios, tecnologías, control territorial, fichas y poder militar. Rotaciones de un mismo mapa no son observaciones independientes.

