# Hito 2 — Bots autónomos

**Estado: cerrado.**

## Objetivo

Hito 2 tiene un objetivo concreto: conseguir jugadores automáticos capaces de completar partidas legales sin intervención humana.

No busca todavía decidir si una civilización está balanceada. Ese análisis pertenece a Hito 3.

## Requisitos de cierre

Para considerar cerrado Hito 2:

- los bots deben jugar las tres fases del turno sin intervención;
- deben producir, transportar, construir, entrenar, investigar, avanzar de Edad, mover y combatir;
- deben elegir posiciones iniciales razonables cuando el reglamento deja esa decisión al jugador;
- deben poder rearmarse después de pérdidas;
- deben perseguir y eliminar rivales;
- deben evitar ciclos evidentes de recursos, movimiento o producción;
- una misma seed y configuración debe repetir el mismo resultado;
- deben existir perfiles de comportamiento distintos;
- la batería automática debe cubrir bots, perfiles y runners;
- el benchmark corto de control debe terminar prácticamente todas las partidas sin modificar reglas para favorecer a la IA.

## Bot base

`bots/baseline.js`

El bot utiliza el mismo `AoEGame` que el resto del simulador. No existe una versión simplificada de las reglas para IA.

Puede:

- PRODUCIR;
- transportar recursos;
- crear Aldeanos;
- construir Cuartel;
- entrenar unidades militares;
- investigar;
- avanzar de Edad;
- mover ejércitos;
- calcular apuestas de Poder de Pelea;
- resolver ataques;
- reconstruir su capacidad militar;
- cambiar de objetivo cuando un rival no es una buena opción;
- planificar rutas de varios turnos atravesando Montañas.

## Elección inicial en FFA

El reglamento indica que los jugadores eligen su posición de CU después de revelar el mapa para adaptarse a él.

La colocación automática reproduce esa secuencia de elección:

- el mapa completo se genera y revela primero;
- P1 evalúa las posiciones exteriores y elige una;
- P2 elige entre las restantes;
- luego P3 y P4;
- dos CU nunca pueden quedar pegados: la distancia hexagonal mínima entre Centros Urbanos es 2;
- el CU se agrega **fuera** de los 48 terrenos, adyacente al borde; nunca ocupa un hexágono interior ni queda rodeado por el mapa;
- la valoración prioriza un arranque favorable: comida y Bosque cercanos, variedad de recursos, acceso a Oro/Piedra, conectividad y separación razonable de CUs ya elegidos;
- posiciones frágiles pueden recibir penalización, pero no quedan prohibidas por una regla artificial.

Esto es una política de decisión del bot, no una modificación del reglamento: intenta imitar que un jugador real mira el mapa revelado y elige el lugar que le parece más conveniente.

## Perfiles

`bots/profiles.js`

Perfiles disponibles:

- `balanced`;
- `aggressive`;
- `economic`;
- `technological`.

Todos usan el mismo motor. Cambian prioridades, tamaño deseado de ejército, expansión económica, agresividad y preferencia por tecnología.

## Determinismo

La combinación de:

- seed del mapa;
- seed del bot;
- civilizaciones;
- asientos;
- perfil;

produce decisiones reproducibles.

Esto permite investigar exactamente una partida anómala.

## Problemas de IA corregidos durante Hito 2

- CUs automáticos sin acceso terrestre útil.
- Elección automática de anclas iniciales que podían desaparecer y aislar el CU.
- Producción repetida de recursos que ya no hacían falta.
- Incapacidad de planificar rutas de varios turnos a través de Montañas.
- Recursos acumulados lejos del centro sin ser transportados.
- Ejércitos gigantes sin presión militar.
- Ataques que trataban el empate como resultado favorable.
- Fijación con un único rival.
- Falta de prioridad de rearme después de pérdidas.
- Crecimiento militar ilimitado.

## Infraestructura ya adelantada de Hito 3

Durante el desarrollo de los bots se construyeron herramientas que pertenecen formalmente a Hito 3:

- runner headless;
- seeds de benchmark;
- rotación de asientos;
- métricas;
- benchmarks FFA;
- duelos controlados;
- artefactos JSON/Markdown.

Se mantienen en el repositorio, pero no forman parte del criterio conceptual de Hito 2.

## Reglas pendientes

Las decisiones de diseño aún abiertas permanecen en `PENDIENTES.md`.

Los bots no deben resolverlas inventando reglas.


## Cierre de Hito 2

Benchmark de cierre:

- 5 mapas fijos;
- 4 rotaciones de asiento por mapa;
- 4 perfiles de bot;
- 80 partidas totales;
- límite de seguridad de 400 rondas;
- **80 partidas terminadas / 80 = 100%**.

Por perfil:

- balanced: 20/20;
- aggressive: 20/20;
- economic: 20/20;
- technological: 20/20.

La batería automática del motor también pasa con éxito.

Este resultado no significa que los bots jueguen óptimamente ni que el juego esté balanceado. Significa que son suficientemente autónomos y estables para convertirse en agentes de prueba de Hito 3.

El sesgo de asientos, las diferencias de win rate, el tamaño de muestra y la calidad estadística se consideran problemas de **Hito 3**, no criterios pendientes de Hito 2.
