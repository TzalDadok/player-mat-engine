# Playtest — 11/10/2026

## Context

- **Fecha:** Domingo 11/10/2026
- **Modo:** Free For All
- **Jugadores:** 2
- **Partidas jugadas:** 2
- **Civilizaciones observadas:** Britones vs. civilización rival

## Resultado general

Ambas partidas terminaron de forma muy similar: los Britones no lograron desplegar unidades militares a tiempo y fueron derrotados en pocos turnos.

## Partida 1

El jugador Britón no consiguió acceso a unidades militares con suficiente rapidez. La posición inicial y la distribución aleatoria de los hexágonos parecen haber dificultado especialmente el acceso a la madera, retrasando el desarrollo necesario para llegar al Cuartel y comenzar a producir ejército.

La partida terminó temprano a favor del rival.

## Partida 2

Se intentó corregir el problema anterior priorizando llegar al Cuartel lo más rápido posible.

Esta vez se logró entrenar una **Milicia**, pero el rival atacó con un **Hombre de Armas**, manteniendo una ventaja militar suficiente para volver a cerrar la partida en pocos turnos.

## Observaciones

- La aleatoriedad de los hexágonos puede generar una diferencia muy grande en la velocidad de desarrollo inicial.
- En ambas partidas, la falta de acceso cercano a **Madera** retrasó de forma crítica el despliegue militar de los Britones.
- En modo Free For All, quedarse varios turnos sin capacidad militar puede ser demasiado castigador.
- El problema podría estar en:
  - la generación/distribución del mapa;
  - el coste o velocidad de acceso al Cuartel;
  - la disponibilidad de unidades militares tempranas;
  - o una combinación de estos factores.
- Aún no hay suficiente evidencia para determinar si se trata de un problema específico de los Britones o de una debilidad general del sistema de inicio.

## Cambios introducidos durante el playtest

### Movimiento de unidades económicas durante la acción Militar

Se probó permitir que la acción **Mover** de la fase Militar también pueda utilizarse para mover **unidades económicas**.

La regla queda así:

- La acción **Mover** de Economía puede mover unidades económicas.
- La acción **Mover** de Militar puede mover unidades militares **o unidades económicas**.
- Las unidades militares **no** pueden moverse utilizando la acción económica.

La intención es acelerar especialmente los primeros turnos, cuando todavía no hay combate y gran parte del tiempo se consume transportando recursos.

Ejemplo observado durante el playtest: una unidad económica puede utilizar la acción Militar para ir a buscar recursos al final de un turno. En el turno siguiente puede regresar con esos recursos utilizando la acción económica, dejando todavía disponible la acción Militar para desarrollar o utilizar el ejército.

La primera impresión es que este cambio reduce turnos poco interesantes al comienzo de la partida sin alterar significativamente el juego posterior, ya que no aumenta la movilidad de las unidades militares.

## Próximas cosas a observar

- Cuántos turnos tarda cada civilización en poder producir su primera unidad militar.
- Qué tan frecuente es quedar sin acceso razonable a Madera.
- Si el mapa aleatorio necesita algún tipo de garantía mínima de recursos iniciales.
- Si el primer jugador que logra desplegar una mejora militar temprana obtiene una ventaja demasiado difícil de remontar.


## Cosas a probar

### Límite de Aldeanos

Probar un límite máximo de **8 Aldeanos por jugador**.

Objetivos de la prueba:
- evitar que la estrategia dominante sea producir Aldeanos de forma indefinida;
- obligar a redistribuir la población existente cuando se quiera ocupar nuevos recursos o expandirse;
- mantener decisiones entre producir, construir, expandirse y reservar Aldeanos para tareas futuras;
- comprobar si 8 permite una economía desarrollada sin saturar el tablero.

El límite sería únicamente para **Aldeanos**. Pesqueros y otras unidades económicas no contarían dentro de ese máximo.

### Red logística por territorios controlados

Evaluar permitir que los recursos puedan gastarse aunque no estén físicamente en el hexágono donde se realiza la acción, siempre que formen parte de una red continua de territorios controlados por el jugador.

Propuesta:

- Los recursos ubicados en hexágonos controlados pueden utilizarse para pagar acciones realizadas en otros hexágonos controlados.
- Debe existir una cadena continua de hexágonos controlados entre el recurso y el lugar donde se realiza la acción.
- Para **CONSTRUIR** sigue siendo obligatorio que haya un **Aldeano** en el hexágono donde se construye.
- Si un enemigo corta la cadena de territorios controlados, los recursos de la zona aislada dejan de estar disponibles para acciones del otro lado de la red.

Objetivos de la prueba:
- reducir el micromanejo de transportar recursos físicamente;
- acelerar el desarrollo inicial;
- mantener importancia estratégica en el control territorial;
- convertir las líneas de territorio en líneas de suministro;
- observar qué tecnologías y unidades logísticas pierden valor y necesitan ser rediseñadas.

Aspectos a vigilar:
- impacto sobre Carretilla, Carreta Mercante y capacidades de transporte;
- impacto sobre Pesqueros, Urca y Logística Naval;
- facilidad con la que un jugador puede negar recursos cortando una conexión territorial;
- si la economía pasa a ser demasiado flexible o rápida.

### Producción automática cada turno

Evaluar eliminar **PRODUCIR** como acción económica elegible y convertir la producción en una fase automática al comienzo de cada turno.

Propuesta de estructura del turno:

1. **Producción automática:** el jugador elige la cantidad de hexágonos productivos permitidos por su Edad y obtiene sus recursos.
2. **Acción económica:** Mover, Construir, Entrenar o Comerciar.
3. **Acción tecnológica:** Investigar, Avanzar de Edad o Modificar Terreno.
4. **Acción militar:** Mover, Entrenar, Construir o Instruir.

Objetivos de la prueba:
- acelerar el comienzo de la partida;
- reducir turnos poco interesantes dedicados únicamente a producir;
- simplificar el seguimiento de la Sobreexplotación;
- hacer que la Sobreexplotación se mida naturalmente entre producciones consecutivas;
- comprobar si la economía general se acelera demasiado.

Con esta variante, un hexágono que produce en turnos consecutivos podría sufrir Sobreexplotación, mientras que un turno en el que no sea elegido para producir contaría como descanso.
