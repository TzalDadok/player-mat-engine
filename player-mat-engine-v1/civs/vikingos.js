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
      ["Producir","Elegí hexagonos para producir."],
      ["Mover","Mueve hasta 2 unidades según su movilidad."],
      ["Construir","Utiliza un aldeano para construir estructuras disponibles."],
      ["Entrenar","Entrena tantas unidades económicas disponibles como puedas pagar."],
      ["Comerciar","Intercambia hasta 2 recursos utilizando el mercado."]
    ],
    technology: [
      ["Investigar","Investiga tecnologías disponibles."],
      ["Avanzar de Edad","Paga los requisitos y desbloquea la siguiente edad."],
      {kind:"terrain",label:"Modificar Terreno",items:[
        {name:"Irrigar",cost:{wood:3,food:3,stone:3},text:"Convierte un hexágono de Desierto en Llanura."},
        {name:"Drenar",cost:{wood:5,food:5,stone:5},text:"Convierte un hexágono de Agua en Desierto."},
        {name:"Fortificar",cost:{wood:3},text:"Agrega empalizada a un lado de un hexágono."}
      ]}
    ],
    military: [
      ["Mover","Mueve hasta 2 unidades según su movilidad."],
      ["Entrenar","Entrena tantas unidades militares disponibles como puedas pagar."],
      {name:"Instruir",cost:{gold:1},text:"Obtén +1 poder de pelea."}
    ]
  },
  unitReference: {
    units: [
      {name:"Aldeano",force:0,range:0,move:1,forceUpgrade:1},
      {name:"Milicia",force:2,range:0,move:1},
      {name:"Arquero",force:1,range:1,move:1},
      {name:"Galera",force:2,range:0,move:1},
      {name:"Escorpión",force:1,range:1,move:0},
      {name:"Trebuchet",force:1,range:3,move:0},
      {name:"Pesquero",force:0,range:0,move:1},
      {name:"Monje",force:0,range:1,move:1}
    ],
    upgrades: [
      {name:"Telar",text:"Aldeano +1 Fuerza."},
      {name:"Guerrero Vikingo",text:"Con 2 o más Milicias en un combate, obtenés +1 Fuerza total."}
    ],
    abilities: [
      {name:"Drakkar",text:"La Galera puede transportar hasta 6 unidades."},
      {name:"Drakkar Mejorado",text:"Al mover una Galera con unidades transportadas, podés desembarcar y mover ese ejército en el mismo turno, como parte de ese movimiento."}
    ],
    bonuses: [
      {from:"Milicia", to:"Construcciones", green:true},
      {from:"Escorpión", to:"Infantería a pie"},
      {from:"Trebuchet", to:"Edificios (+2)"}
    ]
  },
  buildings: [
    {id:"tc",name:"Centro Urbano",image:"assets/buildings/centro-urbano.png"},
    {id:"mill",name:"Campamento Productivo",image:"assets/buildings/molino.png",cost:{wood:3}},
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
    {age:"dark",building:"other",type:"tech",title:"Asent. Vikingo",cost:{food:1,wood:2},text:"Al tomar un hexágono con granjas enemigas sin defensa militar, estas pasan a tu posesión en lugar de destruirse."},
    {age:"dark",building:"mill",type:"tech",title:"Recolección",cost:{food:1,wood:2},text:"Al PRODUCIR en Frutos Silvestres, obtenés +1 Comida adicional, una vez por acción."},
    {age:"dark",building:"mill",type:"tech",title:"Doble Filo",cost:{food:1,gold:1,stone:1},text:"Aldeanos trabajando en el bosque producen +1 madera."},
    {age:"dark",building:"port",type:"civil",title:"Pesquero",cost:{wood:2}},
    {age:"feudal",building:"port",type:"tech",title:"Navegación Comercial",cost:{wood:2,gold:1},text:"Al PRODUCIR con Pesquero, podés elegir 1 Oro en vez de 1 Comida."},
    {age:"dark",building:"port",type:"unit",title:"Galera",cost:{wood:3,gold:1}},
    {age:"dark",building:"barracks",type:"unit",title:"Milicia",cost:{food:1,gold:1}},

    {age:"feudal",building:"tc",type:"tech",title:"Saqueos",cost:{food:2,gold:1},text:"Si un enemigo produce más de 1 recurso y un Aldeano Vikingo está en un hexágono adyacente, 1 recurso de esa producción pasa al hexágono del Aldeano Vikingo."},
    {age:"feudal",building:"mill",type:"civil",title:"Aldeano",cost:{food:2}},
    {age:"feudal",building:"mill",type:"tech",title:"Carretilla",cost:{wood:1,gold:1},text:"Los Aldeanos pueden transportar recursos al MOVER."},
    {age:"castles",building:"tc",type:"tech",title:"Maestros Artesanos",cost:{food:3,gold:4},text:"Al construir, podés sustituir el pago de 1 piedra por 2 maderas."},
    {age:"feudal",building:"port",type:"tech",title:"Pesca Avanzada",cost:{food:2,wood:2},text:"Pesqueros producen +1 Comida."},
    {age:"dark",building:"port",type:"tech",title:"Drakkar",cost:{wood:2,gold:2},text:"La Galera puede transportar hasta 6 unidades."},
    {age:"feudal",building:"barracks",type:"tech",title:"Guerrero Vikingo",cost:{food:2,gold:1},text:"Cuando participan 2 o más Milicias Vikingas en un combate, obtenés +1 Fuerza total."},

    {age:"feudal",building:"other",type:"tech",title:"Desmantelar",cost:{wood:3,gold:3},text:"Como acción económica, podés retirar uno de tus edificios y recuperar 2 recursos de su coste."},
    {age:"dark",building:"other",type:"building",title:"Granja",cost:{wood:2},text:"Produce 2 Comidas."},
    {age:"castles",building:"tc",type:"tech",title:"Carreta Mercante",cost:{wood:3,gold:2},text:"Al comprar recursos en el Mercado, pagás 1 Oro menos por recurso."},
    {age:"castles",building:"barracks",type:"unit",title:"Arquero",cost:{food:1,wood:2,gold:1}},
    {age:"castles",building:"barracks",type:"tech",title:"Hacha de Guerra",cost:{food:2,gold:2},text:"Las Milicias obtienen +1 Fuerza al atacar un hexágono que contenga un edificio enemigo."},
    {age:"castles",building:"other",type:"military-building",title:"Castillo",cost:{stone:4,gold:2},text:"Esta construcción agrega +1 de Fuerza a cualquier batalla que se dé a un hexágono de distancia. Unidad disponible: Milicia."},

    {age:"imperial",building:"tc",type:"military-building",title:"Monasterio",cost:{wood:3,stone:2},text:"Construcción necesaria para guardar reliquias. Unidad disponible: Monje."},
    {age:"imperial",building:"tc",type:"tech",title:"Administración Real",cost:{food:4,gold:3},text:"Tus construcciones producen +1 recurso."},
    {age:"imperial",building:"mill",type:"tech",title:"Colonos del Norte",cost:{wood:3,gold:3},text:"Podés mover una Granja propia a otro hexágono de Llanura o Desierto junto con el Aldeano que la ocupa."},
    {age:"imperial",building:"mill",type:"tech",title:"Comercio Marítimo",cost:{wood:3,gold:3},text:"Podés convertir hasta 2 recursos del mismo tipo ubicados en Agua en la misma cantidad de recursos de tu elección."},
    {age:"castles",building:"port",type:"tech",title:"Drakkar Mejorado",cost:{wood:4,gold:3},text:"Al mover una Galera con unidades transportadas, podés desembarcar y mover ese ejército en el mismo turno, como parte de ese movimiento."},
    {age:"imperial",building:"port",type:"tech",title:"Dominio del Mar",cost:{wood:3,gold:3},text:"Tus Galeras obtienen +1 Fuerza al defender un hexágono de Agua."},
    {age:"imperial",building:"barracks",type:"tech",title:"Jefes Guerreros",cost:{food:3,gold:3},text:"Si ganás un combate, recuperás 1 Poder Militar apostado."},
    {age:"imperial",building:"barracks",type:"tech",title:"Berserkergang",cost:{food:4,gold:3},text:"Cuando atacás con 3 o más Milicias, obtenés +1 al máximo de Poder Militar que podés apostar."},
    {age:"imperial",building:"other",type:"tech",title:"Jarl Saloon",cost:{wood:3,stone:2,gold:3},text:"Puedes entrenar 3 milicias al costo de 2."},
    {age:"castles",building:"mill",type:"military-building",title:"Asedio",cost:{wood:4,stone:2,gold:2},text:"Construí maquinaria que da bonus contra unidades y edificios. Unidad disponible: Escorpión y Trebuchet. Requiere una unidad a pie para trasladarla y un Aldeano para operarla."}
  ]
};
