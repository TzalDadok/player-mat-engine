# Hito 5 — Red logística completa sin producción automática

Muestra: 10 mapas de 60 hexágonos, cuatro rotaciones y cuatro órdenes de elección por mapa; 320 ejecuciones (perfil balanced). Todas conservan los beneficios iniciales del Experimento L.
Variantes: **Actual** y **Red logística completa**. Ambas requieren PRODUCIR como acción económica. En la red, toda construcción, entrenamiento y avance pagado en un hex conectado puede gastar fichas situadas en cualquier otro hex controlado y conectado al CU.
No hay producción automática en ninguna variante: agotamiento, bonificaciones y límites de producción son los actuales.
La red habilita gastos de construcciones y unidades conectadas, además de tecnología y edad. Un destino aislado solo puede gastar sus recursos locales; los recursos fuera de la red no sirven para pagos conectados. El bot tiene acceso a los mismos cálculos de disponibilidad.

## Partidas y economía

| Variante | Terminadas | Rondas promedio | Combates promedio | Recursos producidos | Recursos gastados | Jugadores en Feudal+ al final |
|---|---:|---:|---:|---:|---:|---:|
| actual | 160/160 | 33.20 | 1.33 | 65.08 | 40.58 | 0.04 |
| red_completa_manual | 160/160 | 33.52 | 1.13 | 58.77 | 34.61 | 0.03 |

## Remontadas (último en la ronda 12 o 20 que acaba ganador)

| Variante | R12 casos elegibles | R12 remontadas | R20 casos elegibles | R20 remontadas |
|---|---:|---:|---:|---:|
| actual | 160 | 15.00% | 136 | 6.62% |
| red_completa_manual | 160 | 11.88% | 137 | 5.84% |

Interpretación: los resultados comparan el comportamiento de un perfil de bot concreto, no demuestran balance entre jugadores humanos. El indicador de último usa una puntuación compuesta de ejército, aldeanos, edificios, tecnologías, control territorial, fichas y poder militar. Rotaciones de un mismo mapa no son observaciones independientes.

