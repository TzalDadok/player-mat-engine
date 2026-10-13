# AoE BoardGame — Simulador

## Hito 1: motor base

Estado actual del motor:

- 2 a 4 jugadores.
- Mapa hexagonal con coordenadas axiales.
- Distancia, adyacencia y pathfinding.
- Turno Economía → Tecnología → Militar.
- Una acción por fase y posibilidad de pasar.
- Recursos físicos representados como fichas en hexágonos.
- Carga y descarga de recursos en Aldeanos.
- Producción por hexágonos con límite por Edad: 2 / 3 / 4 / 5.
- Construcción económica y militar.
- Entrenamiento de unidades.
- Avance de Edad.
- Poder Militar e Instruir.
- Movimiento económico en Economía.
- Movimiento económico o militar durante Militar.
- Combate base con apoyo a distancia.
- Apuesta de Poder Militar.
- Empate a favor del defensor.
- Unidades derrotadas vuelven al Centro Urbano.
- Edificios derrotados salen del tablero.
- Eliminación por pérdida del Centro Urbano.
- Log completo de acciones.

## Reglas modeladas de forma provisional

Estas reglas están parametrizadas o simplificadas y deben cerrarse antes de considerar terminado el Hito 1:

1. Recursos iniciales exactos de cada jugador.
2. Generación definitiva del mapa y distribución de recursos.
3. Sobreexplotación / descanso de Animales, Bosque y Montaña.
4. Reglas exactas para construir Puerto.
5. Costes finales de todas las unidades y edificios.
6. Qué unidades están disponibles por civilización y Edad.
7. Tecnologías de civilización y sus modificadores.
8. Bonus de unidad contra unidad y contra edificios.
9. Torre, Castillo, Monasterio y Asedio.
10. Reglas navales.
11. Granjas especiales por civilización.
12. Carta de exploración.
13. Reglas exactas de control territorial.
14. Condiciones específicas para FFA / Competitivo.

## Diseño

El motor no depende de la interfaz. Esto permite usarlo después en:

- partidas visuales;
- bots;
- simulaciones masivas;
- tests A/B de reglas;
- replays;
- estadísticas de balance.

La interfaz debe consumir `AoEGame.snapshot()` y ejecutar acciones mediante los métodos públicos de `AoEGame`.
