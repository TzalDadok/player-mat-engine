# AoE BoardGame — Simulador

## Hito 1 — Motor base

El simulador está separado de la interfaz. El estado completo de una partida vive en `AoEGame`, y las futuras interfaces, bots y simulaciones masivas consumirán ese mismo motor.

### Implementado

- Partidas de 2 a 4 jugadores.
- Modo de partida guardado en el estado.
- Mapa hexagonal mediante coordenadas axiales.
- Distancia, adyacencia y búsqueda de caminos.
- Centro Urbano como hexágono especial, no como edificio.
- Maravilla como hexágono especial.
- Turno: Economía → Tecnología → Militar.
- Hasta una acción de cada categoría y posibilidad de pasar.
- Recursos como fichas físicas sin propietario.
- Control de territorio determinado por unidades y edificios.
- Gasto local para construir y entrenar unidades militares.
- Gasto distribuido entre territorios controlados para Aldeanos, tecnologías, Edad e Instruir.
- Transporte de recursos mediante carga de unidades.
- Producción limitada por Edad: 2 / 3 / 4 / 5 hexágonos.
- Producción de múltiples Aldeanos dentro de un mismo hexágono.
- Molino como productor adicional en Animales y Frutos.
- Campamento de Recursos como productor adicional en Bosque, Oro y Piedra.
- Granjas: máximo 2 por hexágono y producción por parejas Granja + Aldeano.
- Pesca costera.
- Sobreexplotación después de producir dos turnos propios consecutivos.
- Transformación de terrenos agotados:
  - Frutos / Animales / Bosque → Llanura.
  - Oro / Piedra → Agua.
- Movimiento económico durante Economía.
- Movimiento económico o militar durante Militar.
- Movimiento en grupo desde un mismo hexágono.
- Montaña detiene el movimiento al entrar.
- Base del movimiento naval A ↔ B.
- Empalizadas almacenadas por lado de hexágono.
- Construcción económica y militar.
- Regla general de un edificio de cada tipo.
- Entrenamiento de múltiples unidades en una acción.
- Investigación genérica.
- Avance de Edad.
- Irrigar, Drenar y Fortificar.
- Instruir: 1 Oro → +1 Poder de Pelea.
- Poder de Pelea máximo 16.
- Apuesta máxima estándar 7.
- Apoyo de unidades con Alcance.
- Empate de combate a favor del defensor.
- Bajas iguales a la diferencia entre Fuerzas finales.
- Elección explícita de bajas o selección automática para simulaciones.
- Supervivientes derrotados regresan al CU.
- Destrucción de edificios tras conquista.
- Ocupación sin batalla cuando no existe defensa militar.
- Eliminación de civilización al conquistar su Centro Urbano.
- Al eliminar una civilización se retiran unidades y edificios, pero los recursos permanecen.
- Victoria FFA cuando queda una sola civilización.
- Log de acciones de partida.
- Snapshot serializable del estado.

### Tests automáticos

`simulator/tests/hito1-smoke.mjs` comprueba actualmente:

- que el CU no sea tratado como edificio;
- que no aparezcan recursos iniciales inexistentes;
- gasto desde territorios controlados;
- avance de Edad;
- producción con múltiples productores;
- producción extra de Molino;
- sobreexplotación;
- bajas de combate;
- ocupación del territorio;
- conquista y eliminación por Centro Urbano.

GitHub Actions ejecuta estos tests antes de publicar GitHub Pages.

## Integración de civilizaciones

Ya existe una capa independiente en `simulator/civs/` para:

- Britones;
- Francos;
- Vikingos;
- Persas.

El motor ya consulta esa capa para:

- unidades disponibles por civilización y Edad;
- edificios disponibles por civilización y Edad;
- costes particulares;
- puntos de entrenamiento;
- tecnologías y requisitos;
- tecnologías ya investigadas;
- cambios de Fuerza;
- cambios de Movimiento;
- cambios de capacidad de transporte;
- modificadores genéricos de producción;
- terreno permitido para Granjas;
- bloqueo de unidades/edificios de otras civilizaciones.

También expone `civilizationState(playerId)`, `availableUnits()`, `availableBuildings()` y `availableTechnologies()`, pensados para la futura interfaz y los bots.

### Efectos ya interpretados automáticamente

La capa de efectos permite modelar una tecnología como datos, sin agregar `if (civ === ...)` al motor. Ya funcionan, entre otros:

- Carretilla;
- Telar;
- Hombre de Armas;
- Doble Filo;
- Exp. Aurífera / Minería Imperial;
- Canteros;
- Ganadería;
- Qanats para construir Granjas en Desierto;
- bonificación de Qanats junto a Montaña;
- Armadura Laminar;
- Caballería Pesada;
- Flota Imperial;
- Criad. Reales.

Los efectos más contextuales siguen registrados como datos pero se resolverán en los módulos correspondientes de combate/economía avanzada.

### Costes provisionales

Los Player Mats actuales no fijan de forma explícita en el repositorio el coste de algunas unidades habilitadas mediante textos de Castillo, Monasterio o Asedio. Para poder ejecutar el motor, estos costes están marcados como `provisionalCost` y no deben tomarse todavía como balance final:

- Longbow;
- Misionero;
- Monje;
- Ariete;
- Escorpión;
- Trebuchet.

## Falta para cerrar Hito 1

### Combate avanzado

- bonificaciones unidad contra unidad;
- bonificaciones contra construcciones;
- Torre y Castillo;
- Monjes / Misioneros: Curar y Convertir;
- Herejía;
- máquinas de asedio y requisito de Aldeano operador;
- cartas de combate;
- resolución formal de combates pendientes al cierre del turno.

### Mapa y exploración

- generador definitivo de mapas Competitivo y FFA;
- mapa FFA de 48 territorios;
- elección inicial de Centros Urbanos;
- cartas de Exploración;
- exploración de Montañas;
- Reliquias;
- reglas completas de Maravilla;
- cruce/destrucción de empalizadas durante MOVER.

### Otras reglas

- comercio: falta cerrar en qué hexágono quedan físicamente los recursos intercambiados;
- Puerto: falta formalizar la colocación exacta en el modelo;
- scoring y estrellas del modo Competitivo;
- condiciones finales completas de Competitivo.

## Principio de diseño

Las excepciones de civilización no deben quedar codificadas con `if (civ === ...)` dispersos por el motor. Se implementarán como modificadores/datos de civilización para que una simulación pueda cambiar costes, tecnologías o reglas sin reescribir el motor central.
