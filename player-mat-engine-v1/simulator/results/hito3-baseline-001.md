# Hito 3 — Baseline 001

## Identificación

- Fecha: 2026-10-13
- Workflow run: `38342688713`
- Revisión: `12354280386236a96905514808aea91b68f6d5e3`
- Benchmark: `hito3-v1`
- Mapa: `ffa36`
- Seeds: 10 (`bench-001` a `bench-010`)
- Rotaciones por seed: 4
- Perfiles: balanced, aggressive, economic, technological
- Partidas: **160**
- Completadas: **160 / 160 (100%)**
- Rondas promedio: **38.3**

## Civilizaciones

| Civilización | Victorias | Win rate | IC 95% |
|---|---:|---:|---:|
| Britones | 43 | 26.9% | 20.6–34.2% |
| Francos | 38 | 23.8% | 17.8–30.9% |
| Vikingos | 42 | 26.3% | 20.0–33.6% |
| Persas | 37 | 23.1% | 17.3–30.2% |

Los cuatro intervalos se superponen. Esta muestra **no justifica cambios de balance entre civilizaciones**.

## Asientos

| Asiento | Victorias | Win rate | IC 95% | Calidad media de inicio |
|---|---:|---:|---:|---:|
| P1 | 49 | 30.6% | 24.0–38.2% | 45.1 |
| P2 | 38 | 23.8% | 17.8–30.9% | 38.0 |
| P3 | 60 | 37.5% | 30.4–45.2% | 33.3 |
| P4 | 13 | 8.1% | 4.8–13.4% | 28.2 |

La señal por asiento es mucho mayor que la señal por civilización.

La rotación de civilizaciones está funcionando: cada civilización aparece 40 veces en cada asiento. El patrón P4 bajo se observa con las cuatro civilizaciones:

- Britones en P4: 3/40 = 7.5%
- Francos en P4: 3/40 = 7.5%
- Vikingos en P4: 4/40 = 10.0%
- Persas en P4: 3/40 = 7.5%

Por lo tanto, no parece ser un problema de una civilización concreta.

## Economía temprana

Promedios por aparición completada:

| Civilización | Recursos producidos | Recursos gastados |
|---|---:|---:|
| Britones | 16.2 | 10.6 |
| Francos | 15.9 | 10.0 |
| Vikingos | 16.1 | 10.4 |
| Persas | 16.2 | 10.4 |

Estas cifras cuentan producción mediante PRODUCIR y gasto registrado en construcción, entrenamiento, investigación, avance de Edad e INSTRUIR. No deben interpretarse todavía como contabilidad económica exhaustiva de todos los efectos especiales.

## Correcciones previas a esta baseline

Antes de guardar esta corrida se corrigieron dos artefactos de bot:

1. desempates de selección de rival que dependían del orden interno P1→P4;
2. ciclo logístico de `bench-006`, donde un Aldeano llegaba a un recurso en Economía y se alejaba de él en Militar antes de poder producir.

La baseline resultante volvió a 100% de finalización.

## Primera conclusión de Hito 3

**No tocar costes de civilizaciones todavía.**

La prioridad es explicar y aislar el efecto de asiento, especialmente P4. Hay que separar cuánto proviene de:

- orden de elección del CU;
- calidad de la posición inicial disponible;
- orden de turno;
- secuencia de construcción del mapa;
- dinámica FFA/selección de objetivos.

La siguiente comparación debe mantener las civilizaciones rotadas y variar de manera controlada uno de esos factores a la vez.
