window.PLAYER_MAT_CIVS = window.PLAYER_MAT_CIVS || {};
window.PLAYER_MAT_CIVS.britanicos = {
  id: "britanicos",
  name: "BRITONES",
  subtitle: "MAESTROS DEL ARCO",
  motto: "Disciplina, alcance\ny control del territorio.",
  headerImage: "assets/reference-master.png",
  flag: "🏴",
  resources: [
    {id:"food", label:"Comida", icon:"🥩"},
    {id:"wood", label:"Madera", icon:"🪵"},
    {id:"stone", label:"Piedra", icon:"🪨"},
    {id:"gold", label:"Oro", icon:"🪙"}
  ],
  turn: {
    economy: [
      ["Producir","Todos tus aldeanos y edificios productivos elegibles producen."],
      ["Mover","Mové aldeanos y los recursos que transportan."],
      ["Construir","Realizar una construcción económica disponible."],
      ["Entrenar","Entrená una unidad economica disponible."],
      ["Comerciar","Realizá un intercambio utilizando oro, si existe un Mercado."]
    ],
    technology: [
      ["Investigar","Adquirí una tecnología disponible (cuadro verde)."],
      ["Avanzar de Edad","Pagá los requisitos y desbloqueá la siguiente línea del árbol."],
      {
        kind:"terrain",
        label:"Modificar Terreno",
        items:[
          {name:"Irrigar", cost:{wood:3,food:3,stone:3}, text:"Convierte un hexágono de Desierto en Llanura."},
          {name:"Drenar", cost:{wood:5,food:5,stone:5}, text:"Convierte un hexágono de Agua en Desierto."},
          {name:"Fortificar", cost:{wood:3}, text:"Agrega empalizada a un lado de un hexágono."}
        ]
      }
    ],
    military: [
      ["Mover","Mové unidades. Al entrar con enemigos, decidís si combatir."],
      ["Entrenar","Entrená una unidad militar disponible."],
      ["Construir","Realizar una construcción militar disponible."],
      ["Instruir","Obtené +1 Poder de pelea."]
    ]
  },
  unitReference: {
    units: [
      {name:"Aldeano", force:0, range:0, move:1, forceUpgrade:1},
      {name:"Milicia", force:2, range:0, move:1, forceUpgrade:1},
      {name:"Arquero", force:1, range:1, move:1},
      {name:"Escaramuz.", force:1, range:1, move:1},
      {name:"Jinete", force:2, range:0, move:2},
      {name:"Galera", force:2, range:0, move:1},
      {name:"Arq. T. Larg.", force:2, range:2, move:1, forceUpgrade:1},
      {name:"Ariete", force:1, range:0, move:0},
      {name:"Trebuchet", force:1, range:3, move:0},
      {name:"Misionero", force:0, range:1, move:2}
    ],
    upgrades: [
      {name:"Telar", text:"Aldeano +1 Fuerza."},
      {name:"Hombre de Armas", text:"Milicia +1 Fuerza."},
      {name:"Élite", text:"Arquero de Tiro Largo +1 Fuerza."}
    ],
    abilities: [
      {name:"Arquero — Guarnición", text:"Requiere Guarnición. Puede guarecerse en una Torre. Continúa aportando su Fuerza a las batallas. Si la Torre cae, permanece en el hexágono."},
      {name:"Misionero — Conversión", text:"Si vencés una batalla en la que participaron Misioneros, elegí 1 unidad enemiga derrotada por cada Misionero participante. Las unidades elegidas pasan a tu control."},
    ],
    bonuses: [
      {from:"Escaramuzador", to:"Arquero"},
      {from:"Galera", to:"Barcos (◎ 0)"},
      {from:"Ariete", to:"Edificios"},
      {from:"Trebuchet", to:"Edificios (+2)"}
    ]
  },
  buildings: [
    {id:"tc", name:"Centro Urbano", image:"assets/buildings/centro-urbano.png"},
    {id:"mill", name:"Molino", image:"assets/buildings/molino.png", cost:{wood:3}},
    {id:"port", name:"Puerto", image:"assets/buildings/puerto.png", cost:{wood:4,stone:2}},
    {id:"camp", name:"Camp. de Recursos", image:"assets/buildings/campamento-recursos.png", cost:{wood:2}},
    {id:"barracks", name:"Cuartel", image:"assets/buildings/cuartel.png", cost:{wood:1,stone:3,gold:1}},
    {id:"tower", name:"Torre", image:"assets/buildings/torre.png", cost:{stone:3,wood:2}}
  ],
  ages: [
    {id:"dark", roman:"I", name:"ALTA EDAD MEDIA", image:"assets/ages/alta-centro-urbano.jpg"},
    {id:"feudal", roman:"II", name:"EDAD FEUDAL", image:"assets/ages/feudal-centro-urbano.jpg", cost:{food:4,wood:2,stone:1,gold:1}},
    {id:"castles", roman:"III", name:"EDAD DE LOS CASTILLOS", image:"assets/ages/castillos-web.jpg", cost:{food:6,wood:4,stone:2,gold:2}},
    {id:"imperial", roman:"IV", name:"EDAD IMPERIAL", image:"assets/ages/imperial.png", cost:{food:8,wood:6,stone:4,gold:5}}
  ],
  nodes: [
    {age:"dark", building:"tc", type:"civil", title:"Aldeano", cost:{food:1}},
    {age:"dark", building:"mill", type:"civil", title:"Aldeano", cost:{food:2}},
    {age:"dark", building:"mill", type:"building", title:"Granja", cost:{wood:2}, text:"Produce 1 Comida. Puede construirse sobre Llanura."},
    {age:"dark", building:"port", type:"civil", title:"Pesquero", cost:{wood:2}},
    {age:"dark", building:"port", type:"civil", title:"Barco de Transporte", stats:{move:2}, cost:{wood:3}, text:"Unidad capaz de transportar 6 unidades y 6 recursos."},
    {age:"dark", building:"barracks", type:"unit", title:"Milicia", cost:{food:1,gold:1}},
    {age:"dark", building:"barracks", type:"unit", title:"Arquero", cost:{food:1,wood:2,gold:1}},
    {age:"dark", building:"barracks", type:"tech", title:"Hombre de Armas", text:"Tu milicia gana +1 de fuerza."},
    {age:"dark", building:"tower", type:"tech", title:"Guarnición", cost:{food:2,wood:1}, text:"Las unidades de arquería pueden guarecerse en la Torre."},

    {age:"dark", building:"tc", type:"tech", title:"Carretilla", cost:{wood:1,gold:1}, text:"Los aldeanos pueden transportar +1 recurso."},
    {age:"feudal", building:"tc", type:"tech", title:"Telar", cost:{food:1,wood:1}, text:"Tus aldeanos adquieren +1 Fuerza. Ahora pueden entrar a la batalla."},
    {age:"feudal", building:"mill", type:"tech", title:"Pastoreo", cost:{food:1,wood:1}, text:"La comida de ANIMALES puede utilizarse desde cualquier hexágono."},
    {age:"castles", building:"mill", type:"building", title:"Mercado", cost:{wood:3}, text:"Habilita comerciar entre jugadores. Todo comercio debe incluir Oro."},
    {age:"castles", building:"mill", type:"tech", title:"Ganadería", cost:{food:3,wood:2,gold:2}, text:"Los hexágonos de Animales no sufren Sobreexplotación."},
    {age:"feudal", building:"port", type:"tech", title:"Redes de Carga", cost:{wood:4}, text:"Pesqueros pueden transportar 2 recursos."},
    {age:"dark", building:"camp", type:"tech", title:"Doble Filo", cost:{food:1,gold:1,stone:1}, text:"Aldeanos trabajando en el bosque producen +1 madera."},
    {age:"feudal", building:"barracks", type:"unit", title:"Escaramuzador", cost:{food:2,wood:2}},
    {age:"feudal", building:"barracks", type:"tech", title:"Marcha Disciplin.", cost:{food:2,gold:1}, text:"Unidades de arquería entrenadas pueden salir en hexágono adyacente."},
    {age:"feudal", building:"tower", type:"tech", title:"Zona de Control", cost:{wood:2,stone:1}, text:"Las unidades enemigas que entren en un hexágono adyacente a tu Torre deben finalizar allí su movimiento."},

    {age:"castles", building:"tc", type:"tech", title:"Desarrollo", text:"Recuperás el 50% de los recursos que gastaste para alcanzar tu Edad actual."},
    {age:"castles", building:"port", type:"unit", title:"Galera", cost:{wood:3,gold:1}},
    {age:"castles", building:"port", type:"tech", title:"Dominio Naval", cost:{food:3,gold:4}, text:"Si una Galera entra a un hexágono enemigo, su producción queda suspendida."},
    {age:"imperial", building:"port", type:"tech", title:"Espolón Oculto", cost:{wood:2,gold:2}, text:"La galera gana +1 bonus contra barcos sin alcance."},
    {age:"feudal", building:"camp", type:"tech", title:"Exp. Aurífera", cost:{food:3,wood:1,stone:2}, text:"Aldeanos trabajando en una cantera de oro producen +1 oro."},
    {age:"castles", building:"camp", type:"tech", title:"Maestros Artesanos", cost:{food:3,gold:4}, text:"Al construir, podés sustituir el pago de 1 piedra por 2 maderas."},
    {age:"castles", building:"barracks", type:"unit", title:"Jinete", cost:{food:2,gold:3}},
    {age:"castles", building:"tower", type:"military-building", title:"Castillo", cost:{stone:5,gold:3}, text:"Esta construcción agrega +1 de Fuerza a cualquier batalla que se dé a un hexágono de distancia.\nUnidad disponible: Arquero de Tiro Largo."},
    {age:"castles", building:"tc", type:"military-building", title:"Monasterio", cost:{wood:3,stone:2}, text:"Construcción necesaria para guardar reliquias. Unidad disponible: Misionero."},

    {age:"imperial", building:"tc", type:"tech", title:"Admin. Real", cost:{food:4,gold:3}, text:"Tus construcciones producen +1 recurso."},
    {age:"imperial", building:"mill", type:"tech", title:"Carreta Mercante", cost:{wood:3,gold:2}, text:"Podés mover hasta 6 recursos de un hexágono de manera instantánea a otro hexágono que contenga una construcción. Gasta tu acción económica."},
    {age:"imperial", building:"camp", type:"military-building", title:"Asedio", cost:{wood:4,stone:2,gold:2}, text:"Contruye máquinaria que da bonus contra edificios. Unidad disponible: Ariete y Trebuchet. Requiere alguna unidad para su traslado y al menos un aldeano para su uso."},
    {age:"imperial", building:"barracks", type:"tech", title:"Levas", cost:{food:3,gold:3}, text:"Podés entrenar hasta 2 unidades de rango por turno."},
    {age:"imperial", building:"tower", type:"tech", title:"Élite", cost:{food:3,gold:3}, text:"Los Arqueros de Tiro Largo obtienen +1 Fuerza."},
    {age:"imperial", building:"tc", type:"tech", title:"Herejía", cost:{gold:5}, text:"Unidades convertidas por monjes enemigos mueren en lugar de cambiar de bando."}
  ]
};
