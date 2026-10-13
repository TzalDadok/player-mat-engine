# Hito 2 — Bots y simulación de balance

## Objetivo

Hito 2 no busca crear una versión digital jugable.

El objetivo es ejecutar grandes cantidades de partidas sin interfaz para:

- detectar cuellos de botella;
- comparar civilizaciones;
- medir ritmo de desarrollo;
- medir cuándo aparece el primer ejército;
- medir frecuencia y resultado de combates;
- detectar ventajas de posición inicial;
- comparar cambios de costes/reglas sobre exactamente los mismos mapas;
- identificar resultados sensibles al estilo de juego;
- producir evidencia antes de modificar balance.

## Principio metodológico

Una diferencia de win rate **no se considera automáticamente un problema de balance**.

Antes de interpretar un resultado hay que controlar:

1. tasa de partidas terminadas;
2. posición inicial;
3. mapa;
4. seed;
5. estilo del bot;
6. número de partidas;
7. reglas pendientes/provisionales;
8. comportamiento anómalo del bot.

## Infraestructura actual

### Runner headless

`runner/simulate.js`

Ejecuta una partida FFA completa sin navegador.

Registra:

- ganador;
- duración;
- combates;
- jugadores eliminados;
- tecnologías;
- unidades entrenadas;
- territorios;
- recursos;
- diagnósticos de bloqueo;
- hitos temporales.

### Seeds reproducibles

Toda partida usa una seed explícita.

La misma combinación de:

- mapa;
- seed de bot;
- civilizaciones;
- asientos;
- perfil de bot;

debe producir el mismo resultado.

### Benchmark fijo

`runner/benchmark-seeds.js` define 40 mapas de referencia.

El benchmark rota las cuatro civilizaciones por los cuatro asientos, evitando atribuir a una civilización una ventaja que en realidad pertenece a una esquina.

### Perfiles de bot

Actualmente:

- `balanced`;
- `aggressive`;
- `economic`;
- `technological`.

Las civilizaciones se comparan usando el mismo perfil dentro de cada grupo experimental.

### Duelos controlados

`runner/duel-benchmark.mjs` enfrenta cada par de civilizaciones en ambos asientos y bajo los mismos perfiles/seeds.

Esto sirve para detectar matchups particulares sin confundirlos con la dinámica política y multiobjetivo de un FFA.

No representa el modo Competitivo físico ni resuelve su mapa pendiente.

### Métricas temporales

Se registran, entre otras:

- ronda del primer Cuartel;
- ronda de la primera unidad militar;
- ronda de la primera tecnología;
- ronda del primer combate;
- ronda del primer ataque;
- primera eliminación causada;
- llegada a Feudal;
- llegada a Castillos;
- llegada a Imperial.

Estas métricas son especialmente útiles para detectar problemas de tempo aunque el win rate todavía sea incierto.

## Evolución del bot base

Durante el arranque de Hito 2 se detectaron varios errores de IA que contaminaban cualquier lectura de balance:

- CU sin salida terrestre útil;
- producción infinita de un recurso ya innecesario;
- incapacidad de planificar rutas multi-turno atravesando Montañas;
- Aldeanos acumulando recursos lejos del centro sin devolverlos;
- ejércitos absurdamente grandes sin presión militar;
- ataques que ignoraban que el empate favorece al defensor;
- fijación con un único rival bloqueado.

Todos se trataron como errores del simulador/bot, **no como problemas del juego**.

## Primer benchmark de infraestructura

Con 5 mapas fijos, 4 rotaciones de asiento y 4 perfiles:

- 80 partidas;
- 75 terminaron;
- tasa de finalización: 93,8%.

Resultado general observado en esa muestra pequeña:

- Britones: 23,8%;
- Francos: 13,8%;
- Vikingos: 26,3%;
- Persas: 30,0%.

No se considera todavía evidencia suficiente para cambiar balance.

La separación por perfil mostró variaciones importantes, confirmando que el estilo del bot puede alterar sustancialmente el resultado.

## Criterio para empezar a tocar balance

Antes de recomendar cambios de costes o habilidades:

- benchmark con alta tasa de finalización;
- al menos varios perfiles;
- rotación de asientos;
- mismas seeds antes/después;
- muestra mucho mayor que 80 partidas;
- revisar métricas de tempo además de win rate.

## Próximos pasos de Hito 2

1. estabilizar el benchmark por encima de ~95% de finalización;
2. medir hitos temporales por civilización y perfil;
3. aumentar el benchmark a cientos/miles de partidas;
4. ampliar el benchmark de duelos 1v1 controlados sobre el preset FFA48 (ya existe el runner; no representa el mapa Competitivo oficial);
5. agregar comparaciones A/B de cambios de reglas/costes;
6. calcular intervalos de confianza y detectar diferencias estadísticamente débiles;
7. recién entonces proponer cambios de balance.
