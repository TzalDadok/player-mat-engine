# AoE BoardGame — Simulador

## Hito 1 — Motor jugable

**Estado: cerrado para simulación v0.1.**

El simulador usa un único motor de reglas (`AoEGame`) independiente de la interfaz. La misma base queda preparada para el siguiente hito: bots y simulaciones masivas.

La interfaz manual está en:

`/simulator/index.html`

## Qué quedó implementado

### Partida y turno

- 2 a 4 jugadores.
- Fases Economía → Tecnología → Militar.
- Una acción por fase, con posibilidad de pasar.
- Rondas, jugador activo, log completo y snapshot serializable.
- Victoria FFA inmediata cuando queda una sola civilización.
- Puntuación Competitiva y final repentino a 5 estrellas.
- Desempate Competitivo por puntos → territorios → Poder de Pelea.

### Mapa

- Coordenadas hexagonales axiales.
- Adyacencia, distancia y pathfinding.
- Movimiento terrestre y naval.
- Montañas detienen el movimiento.
- Empalizadas por lado de hexágono.
- Dos o más unidades pueden destruir una Empalizada gastando MOVER y quedándose en origen.
- Maravilla.
- Centros Urbanos como hexágonos especiales, no edificios.
- Generador FFA determinista por `seed`.
- Preset FFA: 48 terrenos + Maravilla + CUs externos.
- 32 terrenos primarios y 16 secundarios.
- Repetición exacta de mapas usando la misma `seed`.

### Recursos y economía

- Comida, Madera, Piedra y Oro como fichas físicas sobre el mapa.
- Los recursos no tienen propietario.
- Control territorial determinado por presencia.
- Producción limitada a 2 / 3 / 4 / 5 hexágonos según Edad.
- Producción por múltiples Aldeanos.
- Molino y Campamento como productores adicionales.
- Granjas con hasta 2 pares Granja + Aldeano por hexágono.
- Pesca costera.
- Producción mediante Pesqueros.
- Transporte mediante capacidad de carga.
- Carretilla y tecnologías de transporte.
- Sobreexplotación por producción en dos turnos propios consecutivos.
- Animales / Frutos / Bosque agotados → Llanura.
- Oro / Piedra agotados → Agua.
- Gasto local cuando corresponde.
- Gasto desde territorios controlados cuando corresponde.
- Pastoreo britón.
- Forraje persa.
- Maestros Artesanos / sustitución de Piedra.
- Saqueos vikingos.
- Tributo Real persa.
- Carreta Mercante.
- Desmantelar.
- Excedentes.
- Satrapías.
- Colonos del Norte.
- Captura de Granjas mediante Asentamiento Vikingo.
- Doble Filo, Minería, Canteros, Qanats y otros modificadores de producción.
- Admin. Real aplicado a construcciones productivas.
- Comercio entre jugadores con Mercado y Oro obligatorio.

### Construcción y entrenamiento

- Costes por civilización.
- Disponibilidad por Edad.
- Un edificio de cada tipo salvo excepciones como Granjas.
- Entrenamiento de múltiples unidades en una acción.
- Puntos de entrenamiento alternativos según civilización.
- Caballero franco desde Castillo.
- Milicia vikinga desde Castillo.
- Aldeanos vikingos desde Molino / Campamento según Edad.
- Descuentos de primera unidad.
- Conscripción.
- Flota Tributaria.
- Herrería.
- Criad. Reales.
- Colonización / aparición adyacente.
- Marcha Disciplinada.
- Astillero.
- Ingeniería.
- Movilización.

### Tecnología y terreno

- Investigación según Player Mat.
- Costes y requisitos de Edad.
- Avance secuencial de Edad.
- Irrigar.
- Drenar.
- Fortificar.
- Muralla franca: alternativa de 2 Piedra para Fortificar.
- Conocimiento Ancestral aplicado a tecnologías.

### Civilizaciones

El motor tiene datos independientes para:

- Britones.
- Francos.
- Vikingos.
- Persas.

El motor consulta la civilización para decidir:

- unidades;
- edificios;
- costes;
- edades;
- tecnologías;
- puntos de entrenamiento;
- Fuerza;
- Movimiento;
- Alcance;
- transporte;
- producción;
- habilidades y excepciones.

La lógica central evita depender de `if (civ === ...)` dispersos.

### Combate

- Fuerza base.
- Apoyo a distancia.
- Apuesta de Poder de Pelea.
- Máximo estándar de apuesta 7.
- Poder de Pelea máximo 16.
- Empate para el defensor.
- Bajas iguales a la diferencia de Fuerzas finales.
- Selección manual o automática de bajas.
- Supervivientes derrotados vuelven al CU.
- Edificios destruidos en una conquista.
- Ocupación sin combate cuando no existe defensa militar.
- Eliminación al conquistar el CU.
- Desglose de Fuerza para depuración.
- Bonificaciones por parejas.
- Piquero contra Caballería.
- Escorpión contra unidades a pie.
- Ariete / Trebuchet contra edificios.
- Castillo dando apoyo.
- Torre según tecnología.
- Guerrero Vikingo.
- Hacha de Guerra.
- Carga.
- Mahouts.
- Howdah.
- Rompemuros.
- Berserkergang.
- Fortificación Real.
- Jefes Guerreros.
- Saqueo franco.
- Dominio Naval britón.

### Religiosos

- Monje y Misionero.
- Curar después de calcular bajas.
- Conversión de supervivientes derrotados.
- Herejía.
- Lealtad Imperial persa para Elefantes.
- Encuentro religioso contra religioso: ambos vuelven al CU.
- Reliquias transportadas únicamente por unidades religiosas.
- Las Reliquias caen al terreno cuando corresponde.

### Asedio

- Movimiento 0 propio.
- Transporte junto con otra unidad.
- Aldeano operador requerido para aportar en batalla.
- Ariete.
- Escorpión.
- Trebuchet.

### Torre / Guarnición

- Guarnición britona.
- Arquería guarecida continúa aportando al combate.
- Si la Torre cae, la unidad queda en el hexágono.
- Zona de Control britona.

### Navegación

- Barco de Transporte.
- Galera.
- Embarque desde tierra adyacente.
- Desembarque en tierra adyacente.
- Pasajeros acompañan al barco.
- Drakkar habilita transporte de unidades en Galera.
- Flota Imperial modifica Movimiento.
- Combate Naval Optimizado amplía la red de movimiento.

### Exploración

Mazo determinista de 16 cartas:

- 7 Economía.
- 3 Tecnología.
- 6 Militar.

Implementado:

- una Montaña sólo se explora una vez;
- robo al abandonar una Montaña;
- Tesoro;
- Mercenarios;
- Reliquia;
- Alijo;
- Manos Extra;
- Guías Locales;
- Caravana;
- Caza Abundante;
- Buena Cosecha;
- Ingenio;
- Cartografía;
- Conocimiento Ancestral;
- Refuerzos;
- Marcha Forzada;
- +1 Poder de Pelea;
- +2 Poder de Pelea.

### Reliquias y Maravilla

- Reliquias aparecen en Montaña.
- Carta Reliquia vuelve al mazo y lo remezcla.
- Transporte religioso.
- Depósito en Monasterio.
- Cada Reliquia genera +2 Oro al inicio del turno.
- Si cae el Monasterio, las Reliquias quedan en el hexágono.
- Controlar la Maravilla hace INSTRUIR gratis.

### Competitivo

Objetivos oficiales del reglamento:

- 8 Aldeanos: ★ + 5.
- Todos los edificios: ★ + 5.
- 5 comercios: ★ + 5.
- 15 tecnologías: ★ + 20.
- Imperial: ★ + 10.
- 15 unidades militares: ★ + 15.
- Llegar una vez a 16 Poder de Pelea: ★ + 10.
- Maravilla: ★ + 10, transferible.
- Cada civilización eliminada: ★ + 10 adicionales.

Puntuación territorial:

- Primario: +2.
- Secundario: +1.
- CU: 0.
- Maravilla ya puntúa mediante su objetivo.

Los logros históricos quedan asegurados. El jugador eliminado conserva su puntuación calculada antes de retirar sus componentes.

## Interfaz manual

La interfaz permite actualmente:

- elegir 2, 3 o 4 civilizaciones;
- definir `seed`;
- generar FFA;
- visualizar terreno, CU, Maravilla, unidades, edificios y recursos;
- seleccionar hexágonos y unidades;
- PRODUCIR;
- MOVER;
- CONSTRUIR;
- ENTRENAR;
- INVESTIGAR;
- AVANZAR DE EDAD;
- MODIFICAR TERRENO;
- INSTRUIR;
- ATACAR;
- apostar Poder de Pelea;
- cerrar fases;
- ver la mano de Exploración;
- consultar el log;
- exportar el estado completo como JSON.

Las acciones especiales más raras siguen accesibles desde el motor aunque todavía no todas tienen un control dedicado en la interfaz.

## Tests automáticos

GitHub Actions ejecuta antes de cada deploy:

- smoke test general;
- civilizaciones;
- combate avanzado;
- asedio y religiosos;
- conversión / Herejía / Guarnición / navegación;
- mapa FFA;
- Exploración / Reliquias / Maravilla;
- habilidades económicas;
- cartas de Exploración;
- scoring Competitivo y comercio;
- comprobación sintáctica del motor y de la interfaz.

Si un test falla, GitHub Pages no publica esa versión.

## Convenciones de simulación v0.1

Hay algunos puntos que el reglamento físico aún no define con suficiente precisión. Para poder ejecutar partidas digitales se adoptan estas convenciones, separadas de las reglas oficiales:

1. **Puerto:** el Aldeano se encuentra en tierra adyacente, paga allí el coste y el Puerto se coloca en el hexágono de Agua elegido.
2. **Comercio:** el simulador exige indicar físicamente hexágono de origen y destino de cada lado del intercambio.
3. **FFA48:** la forma compacta usa los anillos 1–3 completos y 12 posiciones repartidas en el anillo 4. La composición por defecto del pool de 32 primarios / 16 secundarios es un preset del simulador hasta disponer del diagrama físico definitivo.
4. **Costes provisionales:** Longbow, Monje, Misionero, Ariete, Escorpión y Trebuchet conservan la marca `provisionalCost`.

## Reglas todavía pendientes de definición externa

No se inventaron estas decisiones porque el propio reglamento / Player Mats no las cierran:

- **Mapa Competitivo:** el reglamento indica expresamente que faltan los diagramas definitivos de 2 y 4 jugadores.
- **Desarrollo britón:** “recuperar 50%” no define cómo redondear Piedra/Oro cuando el coste contiene cantidades impares.
- **Levas britonas:** el texto “hasta 2 unidades de rango” entra en conflicto con la regla general actual de ENTRENAR tantas unidades como puedas pagar.
- **Desembarco franco / Drakkar Mejorado:** hace falta cerrar con precisión cómo se representa una acción adicional de una unidad dentro de un sistema de una sola acción Militar por jugador.
- **Logística Naval vikinga:** falta fijar la capacidad exacta de recursos de cada barco cuando se cargan directamente desde la costa.

Estas cinco decisiones no impiden ejecutar el núcleo del juego ni correr futuras simulaciones; se mantienen visibles para resolverlas en playtest.

## Hitos

- **Hito 1 — Motor jugable:** cerrado.
- **Hito 2 — Bots autónomos:** cerrado; benchmark de cierre 80/80 partidas terminadas; ver `HITO2.md`.
- **Hito 3 — Simulación masiva y balance:** siguiente hito; parte de la infraestructura ya está adelantada; ver `HITO3.md`.

Las decisiones de reglas aún abiertas se mantienen separadas en `PENDIENTES.md`.
