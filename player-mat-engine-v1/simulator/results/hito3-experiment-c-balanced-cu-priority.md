# Hito 3 — Experimento C: prioridad de CU desacoplada del asiento

## Objetivo

Separar dos efectos que en la baseline estaban unidos:

1. asiento / orden de turno;
2. prioridad para elegir Centro Urbano.

El orden de turno se mantiene siempre:

`P1 → P2 → P3 → P4`

La prioridad de elección de CU se sortea de forma reproducible y se balancea experimentalmente.

## Diseño

Por cada combinación de:

- seed;
- perfil de bot;
- rotación de civilizaciones;

se genera un orden aleatorio determinista de P1–P4 y se ejecutan sus cuatro rotaciones cíclicas.

Así, dentro de cada escenario:

- cada asiento elige CU una vez 1.º;
- una vez 2.º;
- una vez 3.º;
- una vez 4.º.

Con 10 seeds:

- referencia A: 160 partidas;
- experimento C: 640 partidas;
- total de la corrida: 800 partidas.

## Finalización

- A: **160/160 = 100%**
- C: **640/640 = 100%**

## Resultado por asiento

| Asiento | A win rate | C win rate | A start score | C start score |
|---|---:|---:|---:|---:|
| P1 | 30.6% | 27.3% | 45.1 | 36.1 |
| P2 | 23.8% | 23.8% | 38.0 | 36.1 |
| P3 | 37.5% | 25.3% | 33.3 | 36.1 |
| P4 | 8.1% | 23.6% | 28.2 | 36.1 |

Rango entre mejor y peor asiento:

- A: **29.4 puntos porcentuales**
- C: **3.8 puntos porcentuales**

Al equilibrar la prioridad de CU, también se iguala exactamente la calidad media inicial de los cuatro asientos: **36.1**.

## Resultado por prioridad de elección de CU

| Prioridad | Apariciones | Win rate | Start score |
|---|---:|---:|---:|
| 1.º | 640 | 32.8% | 45.1 |
| 2.º | 640 | 26.3% | 38.0 |
| 3.º | 640 | 32.5% | 33.3 |
| 4.º | 640 | 8.4% | 28.2 |

La cuarta elección es claramente el problema principal.

El orden no es perfectamente monótono en win rate —3.º supera a 2.º—, lo que indica que todavía hay dinámica FFA además de calidad inicial. Sin embargo, 4.º está muy por debajo de las demás prioridades.

## Civilizaciones

| Civilización | A | C |
|---|---:|---:|
| Britones | 26.9% | 24.7% |
| Francos | 23.8% | 23.9% |
| Vikingos | 26.3% | 26.7% |
| Persas | 23.1% | 24.7% |

Las civilizaciones permanecen agrupadas alrededor de 25%.

## Conclusión

El experimento demuestra que **el sesgo observado originalmente era principalmente un sesgo de prioridad de elección de CU, no de asiento de turno**.

Cuando cada asiento recibe las cuatro prioridades de CU por igual:

- P1–P4 quedan entre 23.6% y 27.3%;
- la diferencia máxima baja a sólo 3.8 pp;
- la calidad inicial media queda idéntica para todos.

Sin embargo, sortear el orden de CU de manera independiente **no resuelve la justicia de una partida individual**: el jugador que elige 4.º continúa teniendo sólo 8.4% de victorias en esta muestra.

Por eso, el próximo problema de diseño no es compensar a P4, sino **reducir la desventaja inherente de ser el cuarto en elegir CU**.

La siguiente prueba más directa es modificar la cantidad/calidad de posiciones exteriores disponibles, por ejemplo aumentando el mapa, sin tocar civilizaciones ni orden de turno.
