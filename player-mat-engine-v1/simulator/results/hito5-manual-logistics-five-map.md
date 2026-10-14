# Hito 5 — Red logística completa sin producción automática

Muestra: 5 mapas de 60 hexágonos, cuatro rotaciones y cuatro órdenes de elección por mapa; 160 ejecuciones (perfil balanced). Todas conservan los beneficios iniciales del Experimento L.
Variantes: **Actual** y **Red logística completa**. Ambas requieren PRODUCIR como acción económica. En la red, toda construcción, entrenamiento y avance pagado en un hex conectado puede gastar fichas situadas en cualquier otro hex controlado y conectado al CU.
No hay producción automática en ninguna variante: agotamiento, bonificaciones y límites de producción son los actuales.
La red habilita gastos de construcciones y unidades conectadas, además de tecnología y edad. Un destino aislado solo puede gastar sus recursos locales; los recursos fuera de la red no sirven para pagos conectados. El bot tiene acceso a los mismos cálculos de disponibilidad.

## Partidas y economía

| Variante | Terminadas | Rondas promedio | Combates promedio | Recursos producidos | Recursos gastados | Jugadores en Feudal+ al final |
|---|---:|---:|---:|---:|---:|---:|
| actual | 78/80 | 31.88 | 0.60 | 54.77 | 32.96 | 0.11 |
| red_completa_manual | 3/80 | 109.67 | 0.00 | 207.90 | 7.80 | 0.00 |

## Remontadas (último en la ronda 12 o 20 que acaba ganador)

| Variante | R12 casos elegibles | R12 remontadas | R20 casos elegibles | R20 remontadas |
|---|---:|---:|---:|---:|
| actual | 78 | 2.56% | 58 | 3.45% |
| red_completa_manual | 3 | 0.00% | 3 | 0.00% |

Interpretación: los resultados comparan el comportamiento de un perfil de bot concreto, no demuestran balance entre jugadores humanos. El indicador de último usa una puntuación compuesta de ejército, aldeanos, edificios, tecnologías, control territorial, fichas y poder militar. Rotaciones de un mismo mapa no son observaciones independientes.

