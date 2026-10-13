# Hito 3 — Experimento B: orden inverso de elección de CU

## Hipótesis

Evaluar si el sesgo observado por asiento en la baseline se explica principalmente por el orden de elección del Centro Urbano.

No se modifica ninguna regla de economía, combate, civilización, construcción del mapa ni orden de turnos.

## Variantes

### A — Baseline

Orden de elección de CU:

`P1 → P2 → P3 → P4`

### B — Orden inverso

Orden de elección de CU:

`P4 → P3 → P2 → P1`

En ambas variantes:

- mapa FFA36;
- mismas 10 seeds;
- mismas 4 rotaciones de civilizaciones;
- mismos 4 perfiles de bot;
- mismo orden de turnos P1 → P2 → P3 → P4;
- misma construcción aleatoria del mapa;
- 160 partidas por variante;
- 320 partidas totales.

## Finalización

- A: **160/160 = 100%**
- B: **160/160 = 100%**

## Resultado por asiento

| Asiento | A win rate | B win rate | A calidad inicial | B calidad inicial |
|---|---:|---:|---:|---:|
| P1 | 30.6% | 11.3% | 45.1 | 28.2 |
| P2 | 23.8% | 28.7% | 38.0 | 33.3 |
| P3 | 37.5% | 33.1% | 33.3 | 38.0 |
| P4 | 8.1% | 26.9% | 28.2 | 45.1 |

El orden inverso invierte también, casi exactamente, la calidad media disponible al elegir CU.

## Resultado por civilización

| Civilización | A | B | Cambio |
|---|---:|---:|---:|
| Britones | 26.9% | 25.6% | -1.3 pp |
| Francos | 23.8% | 22.5% | -1.2 pp |
| Vikingos | 26.3% | 25.0% | -1.3 pp |
| Persas | 23.1% | 26.9% | +3.7 pp |

Las civilizaciones siguen bastante agrupadas. El cambio afecta mucho más a los asientos que al balance global de civilizaciones.

## Lectura

El experimento confirma que **el orden de elección de CU tiene un impacto importante**.

P4 pasa de 8.1% a 26.9% al recibir la primera elección.

Sin embargo, simplemente invertir el orden no elimina el sesgo:

- P1 pasa de 30.6% a sólo 11.3%;
- P3 continúa siendo el asiento con mayor tasa de victoria en B, con 33.1%;
- la amplitud entre mejor y peor asiento baja de 29.4 puntos porcentuales en A a 21.8 en B, pero sigue siendo grande.

Por lo tanto, **B no se recomienda todavía como regla definitiva**.

La evidencia sugiere que hay al menos dos efectos superpuestos:

1. calidad de la posición disponible al elegir CU;
2. otros efectos del asiento, como orden de turno y dinámica de objetivos en FFA.

## Conclusión

**Experimento B: útil, pero no resuelve completamente el sesgo.**

La inversión del orden demuestra causalmente que la prioridad de elección del CU explica una parte importante del problema de P4.

El siguiente experimento debería desacoplar el orden de elección de CU del número de asiento, en lugar de fijarlo siempre normal o siempre invertido.
