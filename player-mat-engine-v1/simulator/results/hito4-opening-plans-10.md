# Hito 4 — Comparación de aperturas económicas en diez rondas

Se ejecutaron secuencias de acciones legales del motor para cuatro jugadores, sin combatir entre ellos, en los mismos 40 mapas.
Cada mapa usa cuatro órdenes de elección de CU y tres políticas de decisión distintas. No se usan tasas de victoria.

**Alcance:** son tres planes heurísticos reproducibles, NO una optimización exhaustiva ni una prueba de juego humano.
Se ejecutan PRODUCIR, MOVER, ENTRENAR, INVESTIGAR y AVANZAR EDAD cuando el motor permite la acción. No se modelan construcciones ni transporte deliberado; tampoco combate.

## Resultados por prioridad y plan

| Plan | Prioridad | Recursos controlados al final | Recursos generados | Acciones mover | Acciones producir | Aldeanos al final | Feudal al turno 10 |
|---|---:|---:|---:|---:|---:|---:|---:|
| produccion | 1 | 0.42 | 5.73 | 3.73 | 5.73 | 1.10 | 0.0% |
| produccion | 2 | 1.09 | 6.21 | 3.11 | 6.21 | 2.16 | 0.0% |
| produccion | 3 | 1.62 | 7.16 | 3.01 | 6.71 | 3.05 | 0.0% |
| produccion | 4 | 1.82 | 6.81 | 2.86 | 6.36 | 3.17 | 0.0% |
| expansion | 1 | 0.27 | 0.63 | 9.36 | 0.42 | 1.18 | 0.0% |
| expansion | 2 | 1.60 | 5.86 | 5.53 | 2.92 | 3.36 | 0.0% |
| expansion | 3 | 2.34 | 7.52 | 5.78 | 3.37 | 3.80 | 0.0% |
| expansion | 4 | 2.48 | 7.26 | 5.04 | 3.54 | 3.92 | 0.0% |
| edad | 1 | 1.24 | 5.47 | 3.63 | 5.21 | 1.96 | 0.0% |
| edad | 2 | 1.82 | 6.83 | 3.62 | 5.96 | 2.00 | 0.0% |
| edad | 3 | 2.78 | 7.91 | 3.42 | 6.33 | 3.00 | 0.0% |
| edad | 4 | 2.51 | 7.37 | 3.24 | 6.03 | 3.00 | 0.0% |

## Limitaciones importantes

La logística del juego se representa parcialmente en el motor: los costes tecnológicos pueden consumir fichas de los territorios controlados sin transportarlas al CU, mientras la construcción y unidades militares exigen pago local. No debe interpretarse la comparación como una prueba completa de transportes.
No se considera el coste de oportunidad militar, las tecnologías alternativas de alto valor ni la estrategia adaptativa de un humano con información parcial.
La ausencia de acciones de CONSTRUIR y del transporte intencional impide optimizar el juego completo; los resultados sirven como diagnóstico de economía de apertura, no como balance definitivo.

