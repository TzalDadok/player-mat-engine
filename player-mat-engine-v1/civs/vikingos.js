window.PLAYER_MAT_CIVS = window.PLAYER_MAT_CIVS || {};
window.PLAYER_MAT_CIVS.vikingos = {
  id: "vikingos",
  name: "VIKINGOS",
  subtitle: "SEÑORES DEL NORTE",
  motto: "Expansión, saqueo y dominio naval.",
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
      ["Producir","Todos tus aldeanos y edificios productivos elegibles producen."],
      ["Mover","Mové aldeanos y los recursos que transportan."],
      ["Construir","Realizar una construcción económica disponible."],
      ["Entrenar","Entrená una unidad economica disponible."],
      ["Comerciar","Realizá un intercambio utilizando oro, si existe un Mercado."]
    ],
    technology: [
      ["Investigar","Adquirí una tecnología disponible (cuadro verde)."],
      ["Avanzar de Edad","Pagá los requisitos y desbloqueá la siguiente línea del árbol."],
      {kind:"terrain",label:"Modificar Terreno",items:[
        {name:"Irrigar",cost:{wood:3,food:3,stone:3},text:"Convierte un hexágono de Desierto en Llanura."},
        {name:"Drenar",cost:{wood:5,food:5,stone:5},text:"Convierte un hexágono de Agua en Desierto."},
        {name:"Fortificar",cost:{wood:3},text:"Agrega empalizada a un lado de un hexágono."}
      ]}
    ],
    military: [
      ["Mover","Mové unidades. Al entrar con enemigos, decidís si combatir."],
      ["Entrenar","Entrená una unidad militar disponible."],
      ["Construir","Realizar una construcción militar disponible."],
      {name:"Instruir",cost:{gold:1},text:"Obtené +1 Poder de pelea."}
    ]
  },
  unitReference: {
    units: [
      {name:"Aldeano",force:0,range:0,move:1,forceUpgrade:1},
      {name:"Milicia",force:2,range:0,move:1},
      {name:"Arquero",force:1,range:1,move:1},
      {name:"Galera",force:2,range:0,move:1}
    ],
    upgrades: [
      {name:"Telar",text:"Aldeano +1 Fuerza."},
      {name:"Guerrero Vikingo",text:"Con 2 o más Milicias en un combate, obtenés +1 Fuerza total."}
    ],
    abilities: [
      {name:"Drakkar",text:"La Galera puede transportar hasta 6 unidades."},
      {name:"Drakkar Mejorado",text:"Las unidades que desembarcan desde una Galera pueden realizar una acción Militar ese mismo turno."}
    ],
    bonuses: []
  },
  buildings: [
    {id:"tc",name:"Centro Urbano",image:"assets/buildings/centro-urbano.png"},
    {id:"mill",name:"Molino",image:"assets/buildings/molino.png",cost:{wood:3}},
    {id:"camp",name:"Camp. de Recursos",image:"assets/buildings/campamento-recursos.png",cost:{wood:2}},
    {id:"port",name:"Puerto",image:"assets/buildings/puerto.png",cost:{wood:4,stone:2}},
    {id:"barracks",name:"Cuartel",image:"assets/buildings/cuartel.png",cost:{wood:1,stone:3,gold:1}},
    {id:"other",name:"Otros",image:""}
  ],
  ages: [
    {id:"dark",roman:"I",name:"ALTA EDAD MEDIA",image:"assets/ages/alta-centro-urbano.jpg"},
    {id:"feudal",roman:"II",name:"EDAD FEUDAL",image:"assets/ages/feudal-centro-urbano.jpg",cost:{food:4,wood:2,stone:1,gold:1}},
    {id:"castles",roman:"III",name:"EDAD DE LOS CASTILLOS",image:"assets/ages/castillos-web.jpg",cost:{food:6,wood:4,stone:2,gold:2}},
    {id:"imperial",roman:"IV",name:"EDAD IMPERIAL",image:"assets/ages/imperial.png",cost:{food:8,wood:6,stone:4,gold:5}}
  ],
  nodes: [
    {age:"dark",building:"tc",type:"civil",title:"Aldeano",cost:{food:1}},
    {age:"dark",building:"tc",type:"tech",title:"Telar",cost:{food:1,wood:1},text:"Tus aldeanos adquieren +1 Fuerza. Ahora pueden entrar a la batalla."},
    {age:"dark",building:"mill",type:"tech",title:"Asent. Vikingo",cost:{food:1,wood:2},text:"Al tomar un hexágono con granjas enemigas sin defensa militar, estas pasan a tu posesión en lugar de destruirse."},
    {age:"dark",building:"camp",type:"tech",title:"Doble Filo",cost:{food:1,gold:1,stone:1},text:"Aldeanos trabajando en el bosque producen +1 madera."},
    {age:"dark",building:"port",type:"civil",title:"Pesquero",cost:{wood:2}},
    {age:"dark",building:"port",type:"tech",title:"Urca",cost:{wood:2,gold:1},text:"Los pesqueros pueden transportar recursos ilimitados."},
    {age:"dark",building:"port",type:"unit",title:"Galera",cost:{wood:3,gold:1}},
    {age:"dark",building:"barracks",type:"unit",title:"Milicia",cost:{food:1,gold:1}},

    {age:"feudal",building:"tc",type:"tech",title:"Saqueos",cost:{food:2,gold:1},text:"Si un enemigo produce más de 1 recurso y un Aldeano Vikingo está en un hexágono adyacente, 1 recurso de esa producción pasa al hexágono del Aldeano Vikingo."},
    {age:"feudal",building:"mill",type:"civil",title:"Aldeano",cost:{food:2}},
    {age:"feudal",building:"camp",type:"tech",title:"Carretilla",cost:{wood:1,gold:1},text:"Los aldeanos pueden transportar +1 recurso."},
    {age:"feudal",building:"camp",type:"tech",title:"Maest. Artesanos",cost:{food:3,gold:4},text:"Al construir, podés sustituir el pago de 1 piedra por 2 maderas."},
    {age:"feudal",building:"port",type:"tech",title:"Drakkar",cost:{wood:2,gold:2},text:"La Galera puede transportar hasta 6 unidades."},
    {age:"feudal",building:"barracks",type:"tech",title:"Guerrero Vikingo",cost:{food:2,gold:1},text:"Cuando participan 2 o más Milicias Vikingas en un combate, obtenés +1 Fuerza total."},

    {age:"castles",building:"tc",type:"building",title:"Mercado",cost:{wood:3},text:"Habilita comerciar entre jugadores. Todo comercio debe incluir Oro."},
    {age:"castles",building:"tc",type:"tech",title:"Desmantelar",cost:{wood:3,gold:3},text:"Como acción económica, podés retirar uno de tus edificios y recuperar 2 recursos de su coste."},
    {age:"castles",building:"mill",type:"building",title:"Granja",cost:{wood:2},text:"Produce 1 Comida. Puede construirse sobre Llanura."},
    {age:"castles",building:"camp",type:"civil",title:"Aldeano",cost:{food:2}},
    {age:"castles",building:"camp",type:"tech",title:"Carreta Mercante",cost:{wood:3,gold:2},text:"Podés mover hasta 6 recursos de un hexágono de manera instantánea a otro hexágono que contenga una construcción. Gasta tu acción económica."},
    {age:"castles",building:"port",type:"tech",title:"Comb. Naval Opt.",cost:{wood:3,gold:3},text:"Los barcos pueden recorrer todos los hexágonos de Agua y desembarcar sus unidades en un hexágono adyacente utilizando una única acción."},
    {age:"castles",building:"barracks",type:"unit",title:"Arquero",cost:{food:1,wood:2,gold:1}},
    {age:"castles",building:"barracks",type:"tech",title:"Hacha de Guerra",cost:{food:2,gold:2},text:"Las Milicias obtienen +1 Fuerza al atacar un hexágono que contenga un edificio enemigo."},
    {age:"castles",building:"other",type:"military-building",title:"Castillo",cost:{stone:4,gold:2},text:"Esta construcción agrega +1 de Fuerza a cualquier batalla que se dé a un hexágono de distancia. Unidad disponible: Milicia."},

    {age:"imperial",building:"tc",type:"tech",title:"Admin. Real",cost:{food:4,gold:3},text:"Tus construcciones producen +1 recurso."},
    {age:"imperial",building:"port",type:"tech",title:"Drakkar Mejorado",cost:{wood:4,gold:3},text:"Las unidades que desembarcan desde una Galera pueden realizar una acción Militar ese mismo turno."},
    {age:"imperial",building:"barracks",type:"tech",title:"Jefes Guerreros",cost:{food:3,gold:3},text:"Si ganás un combate, recuperás 1 Poder Militar apostado."},
    {age:"imperial",building:"barracks",type:"tech",title:"Berserkergang",cost:{food:4,gold:3},text:"Cuando atacás con 3 o más Milicias, obtenés +1 al máximo de Poder Militar que podés apostar."},
    {age:"imperial",building:"other",type:"tech",title:"Salón de los Jarls",cost:{wood:3,stone:2,gold:3},text:"Al ENTRENAR Milicias desde un Castillo, podés entrenar 2 con una sola acción, pagando el coste de ambas."}
  ]
};
