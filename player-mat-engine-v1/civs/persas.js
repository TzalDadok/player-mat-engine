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
      ["Producir","Elegí hexágonos productivos. Los productores elegibles en ellos generan sus recursos. I: 2 · II: 3 · III: 4 · IV: 5."],
      ["Mover","Mové tus unidades según su capacidad de Movimiento."],
      ["Construir","Realizar una construcción económica disponible."],
      ["Entrenar","Entrená tantas unidades económicas disponibles como puedas pagar."],
      ["Comerciar","Realizá un intercambio utilizando oro, si existe un Mercado."]
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
      ["Construir","Realizar una construcción militar disponible."],
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
      {name:"Elefante",force:3,range:0,move:1,forceUpgrade:1}
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
    {id:"mill",name:"Molino",image:"assets/buildings/molino.png",cost:{wood:3}},
    {id:"camp",name:"Camp. de Recursos",image:"assets/buildings/campamento-recursos.png",cost:{wood:2}},
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
    {age:"dark",building:"camp",type:"tech",title:"Carretilla",cost:{wood:1,gold:1},text:"Al PRODUCIR, un Aldeano de tu elección genera +1 recurso adicional."},
    {age:"dark",building:"port",type:"civil",title:"Pesquero",cost:{wood:2}},
    {age:"dark",building:"port",type:"civil",title:"Barco de Transporte",stats:{move:2},cost:{wood:3},text:"Unidad capaz de transportar hasta 6 unidades."},
    {age:"dark",building:"barracks",type:"unit",title:"Milicia",cost:{food:1,gold:1}},
    {age:"dark",building:"barracks",type:"unit",title:"Arquero",cost:{food:1,wood:2,gold:1}},
    {age:"dark",building:"tower",type:"tech",title:"Guardia de Frontera",cost:{wood:1,stone:1},text:"La Torre aporta +1 Fuerza a las batallas en su propio hexágono."},

    {age:"dark",building:"tc",type:"tech",title:"Telar",cost:{food:1,wood:1},text:"Tus aldeanos adquieren +1 Fuerza. Ahora pueden entrar a la batalla."},
    {age:"feudal",building:"tc",type:"tech",title:"Camino Real",cost:{food:2,wood:2},text:"Un Aldeano que parte de una construcción propia puede mover 2 hexágonos si termina en otra construcción propia."},
    {age:"feudal",building:"mill",type:"tech",title:"Qanats",cost:{wood:2,stone:2},text:"Podés construir Granjas en Desierto. Si están adyacentes a una Montaña, producen +1 Comida."},
    {age:"feudal",building:"camp",type:"tech",title:"Minería Imperial",cost:{food:3,wood:1,stone:2},text:"Aldeanos trabajando en una cantera de Oro producen +1 Oro."},
    {age:"feudal",building:"port",type:"tech",title:"Redes de Carga",cost:{wood:4},text:"Cada Pesquero puede PRODUCIR en su hexágono de Agua y en otro hexágono de Agua adyacente. Los recursos quedan en el hexágono donde se producen."},
    {age:"feudal",building:"barracks",type:"unit",title:"Piquero",cost:{food:2,wood:1}},
    {age:"feudal",building:"tower",type:"tech",title:"Fortificación Real",cost:{wood:2,stone:2},text:"Cuando una Torre participa en una batalla defensiva, obtenés +1 al máximo de Poder Militar que podés apostar."},

    {age:"castles",building:"tc",type:"building",title:"Mercado",cost:{wood:3},text:"Habilita comerciar entre jugadores. Todo comercio debe incluir Oro."},
    {age:"castles",building:"mill",type:"tech",title:"Forraje",cost:{food:3,wood:2,gold:1},text:"Los Elefantes de Guerra cuestan −1 Comida."},
    {age:"castles",building:"camp",type:"tech",title:"Tributo Real",cost:{food:2,wood:2,gold:2},text:"El Centro Urbano puede PRODUCIR 1 recurso de tu elección."},
    {age:"castles",building:"port",type:"unit",title:"Galera",cost:{wood:3,gold:1}},
    {age:"castles",building:"port",type:"tech",title:"Flota Tributaria",cost:{wood:3,gold:2},text:"La primera Galera que entrenes durante tu turno cuesta 1 Madera menos."},
    {age:"castles",building:"barracks",type:"unit",title:"Elefante de Guerra",cost:{food:4,gold:4}},
    {age:"castles",building:"barracks",type:"tech",title:"Mahouts",cost:{food:2,gold:3},text:"Si al menos un Elefante combate junto a una unidad militar a pie, obtenés +1 Fuerza total en esa batalla."},
    {age:"castles",building:"tower",type:"military-building",title:"Castillo",cost:{stone:4,gold:2},text:"Esta construcción agrega +1 de Fuerza a cualquier batalla que se dé a un hexágono de distancia."},

    {age:"imperial",building:"tc",type:"tech",title:"Satrapías",cost:{food:4,gold:4},text:"Tus construcciones cuestan −1 Piedra."},
    {age:"imperial",building:"mill",type:"tech",title:"Criad. Reales",cost:{food:3,wood:2,gold:2},text:"Los Elefantes de Guerra cuestan 1 Comida menos al entrenarse."},
    {age:"imperial",building:"camp",type:"tech",title:"Armadura Laminar",cost:{stone:3,gold:4},text:"Los Elefantes de Guerra obtienen +1 Fuerza."},
    {age:"imperial",building:"port",type:"tech",title:"Flota Imperial",cost:{food:2,wood:3,gold:2},text:"Barcos de Transporte y Galeras obtienen +1 Movimiento."},
    {age:"imperial",building:"barracks",type:"tech",title:"Howdah",cost:{food:3,wood:2,gold:3},text:"Los Arqueros que se encuentren en el mismo hexágono que un Elefante obtienen +1 Alcance."},
    {age:"imperial",building:"barracks",type:"tech",title:"Rompemuros",cost:{food:3,gold:4},text:"El bonus de Elefante contra Construcciones pasa a +2."},
    {age:"imperial",building:"tower",type:"tech",title:"Lealtad Imperial",cost:{gold:5},text:"Los Elefantes convertidos por unidades enemigas mueren en lugar de cambiar de jugador."}
  ]
};
