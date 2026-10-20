window.PLAYER_MAT_CIVS = window.PLAYER_MAT_CIVS || {};
window.PLAYER_MAT_CIVS.persas = {
  id: "persas",
  name: "PERSAS",
  subtitle: "IMPERIO DE LOS ELEFANTES",
  motto: "Rutas, riqueza y fuerza aplastante.",
  headerImage: "assets/reference-master.png",
  flag: "",
  resources: [
    {id:"food", label:"Comida", icon:"🥩"},
    {id:"wood", label:"Madera", icon:"🪵"},
    {id:"stone", label:"Piedra", icon:"🪨"},
    {id:"gold", label:"Oro", icon:"🪙"}
  ],
  turn: {
    economy: [
      ["Producir","Elegí hexagonos para producir."],
      ["Mover","Mové 1 hexágono a pie o 2 montado. Un grupo se mueve al ritmo del más lento."],
      ["Construir","Construí una estructura disponible, económica o militar, con un Aldeano en el hexágono."],
      ["Entrenar","Entrená tantas unidades económicas disponibles como puedas pagar."],
      ["Comerciar","Comprá o vendé hasta 2 recursos a precios compartidos. Acuerdos entre jugadores: solo por Oro."]
    ],
    technology: [
      ["Investigar","Adquirí una tecnología disponible (cuadro verde)."],
      ["Avanzar de Edad","Pagá los requisitos y desbloqueá la siguiente línea del árbol."],
      {
        kind:"terrain",
        label:"Modificar Terreno",
        items:[
          {name:"Irrigar",cost:{wood:3,food:3,stone:3},text:"Convierte un hexágono de Desierto en Llanura."},
          {name:"Drenar",cost:{wood:5,food:5,stone:5},text:"Convierte un hexágono de Agua en Desierto."},
          {name:"Fortificar",cost:{wood:3},text:"Agrega empalizada a un lado de un hexágono."}
        ]
      }
    ],
    military: [
      ["Mover","Mové unidades militares o económicas. Al entrar con enemigos, decidís si combatir."],
      ["Entrenar","Entrená tantas unidades militares disponibles como puedas pagar."],
      {name:"Instruir",cost:{gold:1},text:"Obtené +1 Poder de pelea."}
    ]
  },
  unitReference: {
    units: [
      {name:"Aldeano",force:0,range:0,move:1,forceUpgrade:1},
      {name:"Milicia",force:2,range:0,move:1},
      {name:"Arquero",force:1,range:1,move:1},
      {name:"Piquero",force:1,range:0,move:1},
      {name:"Galera",force:2,range:0,move:1},
      {name:"Elefante",force:3,range:0,move:2,forceUpgrade:1}
    ],
    upgrades: [
      {name:"Telar",text:"Aldeano +1 Fuerza."},
      {name:"Armadura Laminar",text:"Elefante de Guerra +1 Fuerza."}
    ],
    abilities: [
      {name:"Mahouts",text:"Si un Elefante combate junto a una unidad militar a pie, obtenés +1 Fuerza total."},
      {name:"Howdah",text:"Los Arqueros en el mismo hexágono que un Elefante obtienen +1 Alcance."}
    ],
    bonuses: [
      {from:"Piquero",to:"Caballería"},
      {from:"Piquero",to:"Elefante (+2)"},
      {from:"Elefante",to:"Construcciones"},
      {from:"Elefante",to:"Construcciones (+2)",green:true}
    ]
  },
  buildings: [
    {id:"tc",name:"Centro Urbano",image:"assets/buildings/centro-urbano.png"},
    {id:"mill",name:"Campamento Productivo",image:"assets/buildings/molino.png",cost:{wood:2}},
    {id:"port",name:"Puerto",image:"assets/buildings/puerto.png",cost:{wood:4,stone:2}},
    {id:"barracks",name:"Cuartel",image:"assets/buildings/cuartel.png",cost:{wood:1,stone:3,gold:1}},
    {id:"tower",name:"Torre",image:"assets/buildings/torre.png",cost:{stone:3,wood:2}}
  ],
  ages: [
    {id:"dark",roman:"I",name:"ALTA EDAD MEDIA",image:"assets/ages/alta-centro-urbano.jpg"},
    {id:"feudal",roman:"II",name:"EDAD FEUDAL",image:"assets/ages/feudal-centro-urbano.jpg",cost:{food:4,wood:2,stone:1,gold:1}},
    {id:"castles",roman:"III",name:"EDAD DE LOS CASTILLOS",image:"assets/ages/castillos-web.jpg",cost:{food:6,wood:4,stone:2,gold:2}},
    {id:"imperial",roman:"IV",name:"EDAD IMPERIAL",image:"assets/ages/imperial.png",cost:{food:8,wood:6,stone:4,gold:5}}
  ],
  nodes: [
    {age:"dark",building:"tc",type:"civil",title:"Aldeano",cost:{food:1}},
    {age:"dark",building:"mill",type:"building",title:"Granja",cost:{wood:2},text:"Produce 1 Comida. Puede construirse sobre Llanura."},
    {age:"dark",building:"mill",type:"tech",title:"Carretilla",cost:{wood:1,gold:1},text:"Al PRODUCIR, un Aldeano de tu elección genera +1 recurso adicional."},
    {age:"dark",building:"port",type:"civil",title:"Pesquero",cost:{wood:2}},
    {age:"dark",building:"port",type:"civil",title:"Barco de Transporte",stats:{move:2},cost:{wood:3},text:"Unidad capaz de transportar hasta 6 unidades."},
    {age:"dark",building:"barracks",type:"unit",title:"Milicia",cost:{food:1,gold:1}},
    {age:"dark",building:"barracks",type:"unit",title:"Arquero",cost:{food:1,wood:2,gold:1}},
    {age:"dark",building:"tower",type:"tech",title:"Guardia de Frontera",cost:{wood:1,stone:1},text:"La Torre aporta +1 Fuerza a las batallas en su propio hexágono."},

    {age:"dark",building:"tc",type:"tech",title:"Telar",cost:{food:1,wood:1},text:"Tus aldeanos adquieren +1 Fuerza. Ahora pueden entrar a la batalla."},
    {age:"feudal",building:"tc",type:"tech",title:"Camino Real",cost:{food:2,wood:2},text:"Un Aldeano que parte de una construcción propia puede mover 2 hexágonos si termina en otra construcción propia."},
    {age:"feudal",building:"mill",type:"tech",title:"Qanats",cost:{wood:2,stone:2},text:"Podés construir Granjas en Desierto. Si están adyacentes a una Montaña, producen +1 Comida."},
    {age:"feudal",building:"mill",type:"tech",title:"Minería Imperial",cost:{food:3,wood:1,stone:2},text:"Aldeanos trabajando en una cantera de Oro producen +1 Oro."},
    {age:"feudal",building:"port",type:"tech",title:"Redes de Carga",cost:{wood:4},text:"Cada Pesquero puede PRODUCIR en su hexágono de Agua y en otro hexágono de Agua adyacente. Los recursos quedan en el hexágono donde se producen."},
    {age:"feudal",building:"barracks",type:"unit",title:"Piquero",cost:{food:2,wood:1}},
    {age:"feudal",building:"tower",type:"tech",title:"Fortificación Real",cost:{wood:2,stone:2},text:"Cuando una Torre participa en una batalla defensiva, obtenés +1 al máximo de Poder Militar que podés apostar."},

    {age:"castles",building:"tc",type:"tech",title:"Tesorería Real",cost:{food:2,gold:3},text:"Una vez por turno, al gastar al menos 3 Oro en una misma acción, recuperás 1 Oro."},
    {age:"castles",building:"mill",type:"tech",title:"Forraje",cost:{food:3,wood:2,gold:1},text:"Pendiente de adaptación a la regla de movimiento fijo de unidades montadas."},
    {age:"castles",building:"mill",type:"tech",title:"Tributo Real",cost:{food:2,wood:2,gold:2},text:"El Centro Urbano puede PRODUCIR 1 recurso de tu elección."},
    {age:"castles",building:"mill",type:"tech",title:"Canteros Reales",cost:{food:2,wood:2,gold:2},text:"Una vez por acción PRODUCIR, un hexágono de Piedra elegido genera +1 Piedra adicional."},
    {age:"castles",building:"port",type:"unit",title:"Galera",cost:{wood:3,gold:1}},
    {age:"castles",building:"port",type:"tech",title:"Flota Tributaria",cost:{wood:3,gold:2},text:"La primera Galera que entrenes durante tu turno cuesta 1 Madera menos."},
    {age:"castles",building:"barracks",type:"unit",title:"Elefante de Guerra",cost:{food:4,gold:4}},
    {age:"castles",building:"barracks",type:"tech",title:"Mahouts",cost:{food:2,gold:3},text:"Elefante + unidad militar a pie: +1 Fuerza total en combate."},
    {age:"castles",building:"tower",type:"military-building",title:"Castillo",cost:{stone:4,gold:2},text:"Aporta +1 Fuerza a batallas a 1 hexágono."},
    {age:"castles",building:"tower",type:"tech",title:"Arquitectura Persa",cost:{wood:2,gold:3},text:"Castillo: +1 Fuerza adicional al defender su hexágono."},

    {age:"imperial",building:"tc",type:"military-building",title:"Monasterio",cost:{wood:3,stone:2},text:"Construcción necesaria para guardar reliquias. Unidad disponible: Monje."},
    {age:"imperial",building:"tc",type:"tech",title:"Satrapías",cost:{food:3,gold:3},text:"Tus construcciones cuestan −1 Piedra."},
    {age:"imperial",building:"mill",type:"tech",title:"Criad. Reales",cost:{food:3,wood:2,gold:2},text:"Los Elefantes de Guerra cuestan 1 Comida menos al entrenarse."},
    {age:"imperial",building:"mill",type:"tech",title:"Ingeniería Hidráulica",cost:{wood:3,stone:2,gold:2},text:"⚠ PENDIENTE DE REVISIÓN: su efecto de evitar la sobreexplotación ya no aplica. No investigar hasta redefinir."},
    {age:"imperial",building:"mill",type:"tech",title:"Armadura Laminar",cost:{stone:3,gold:4},text:"Los Elefantes de Guerra obtienen +1 Fuerza."},
    {age:"imperial",building:"port",type:"tech",title:"Flota Imperial",cost:{food:2,wood:3,gold:2},text:"Barcos de Transporte y Galeras obtienen +1 Movimiento."},
    {age:"imperial",building:"barracks",type:"tech",title:"Howdah",cost:{food:3,wood:2,gold:3},text:"Los Arqueros que se encuentren en el mismo hexágono que un Elefante obtienen +1 Alcance."},
    {age:"imperial",building:"barracks",type:"tech",title:"Rompemuros",cost:{food:3,gold:4},text:"El bonus de Elefante contra Construcciones pasa a +2."},
    {age:"imperial",building:"tower",type:"tech",title:"Lealtad Imperial",cost:{gold:5},text:"Los Elefantes convertidos por unidades enemigas mueren en lugar de cambiar de jugador."},
    {age:"imperial",building:"tower",type:"tech",title:"Guardia de Palacio",cost:{food:3,gold:3},text:"Las unidades militares que defienden el Centro Urbano obtienen +1 Fuerza total."},
  ]
};
