# Hito 2 — Bots autónomos

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

La colocación automática imita una decisión humana básica:

- exige acceso a la red terrestre central;
- evita Agua;
- si existen alternativas suficientes, evita usar Oro/Piedra como ancla inmediata del CU, porque esos territorios pueden agotarse y transformarse en Agua.

Esto es una política del bot de preparación, no una modificación de las reglas del mapa.

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
