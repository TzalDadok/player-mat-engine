# Hito 4 — Auditoría de acceso económico inicial (40 mapas, FFA60)

Se analizaron 40 mapas con 4 órdenes de elección de CU por mapa y 4 asientos por orden; 640 inicios medidos.
Los aldeanos se ubican como en el simulador: CU y hasta dos hexágonos terrestres vecinos, ordenados por ID.

**Esta prueba mide oportunidades iniciales y límites de acciones, no simula todavía una estrategia óptima de 10 rondas.**

## Restricción de las primeras diez rondas
- 10 acciones económicas como máximo; PRODUCIR, MOVER y CONSTRUIR compiten por esas acciones.
- En Alta Edad Media, cada acción PRODUCIR puede seleccionar hasta 2 hexágonos productivos.
- Los aldeanos adicionales no sustituyen acciones de movimiento, investigación, construcción ni transporte.

## Acceso inicial por prioridad

| Prioridad | Aldeanos | Aldeanos en recurso (inicio) | Producción inmediata máxima (por acción) | Máxima tras 1 movimiento (por acción) | Distancia media mínima a comida | madera | oro | piedra | Tipos accesibles a 2 pasos |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1.ª | 1 | 0.00 | 0.00 | 1.00 | 1.43 | 1.60 | 2.48 | 2.23 | 2.98 |
| 2.ª | 2 | 0.60 | 0.60 | 1.60 | 0.90 | 1.10 | 1.88 | 2.00 | 3.35 |
| 3.ª | 3 | 1.15 | 1.15 | 2.15 | 0.53 | 1.25 | 1.55 | 1.60 | 3.67 |
| 4.ª | 3 | 1.07 | 1.07 | 2.08 | 0.70 | 1.43 | 1.88 | 1.60 | 3.35 |

## Limitaciones y siguiente paso
La producción inicial calculada se basa en Aldeanos sobre fuentes y un máximo de 2 hexágonos por acción. No descuenta agotamiento, cambios de estado de recursos ni considera edificios, tecnologías, consumo, transporte o combate.
El máximo tras un movimiento es un límite optimista de producción por acción, no un total de recursos durante las primeras diez rondas.
Para comparar desarrollo humano real a 10 rondas falta construir un planificador de acciones legales por civilización que optimice varios objetivos (economía, edad y defensa) y contabilice el traslado de recursos.

