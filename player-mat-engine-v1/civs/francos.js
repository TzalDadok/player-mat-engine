window.PLAYER_MAT_CIVS = window.PLAYER_MAT_CIVS || {};
window.PLAYER_MAT_CIVS.francos = {
  id: "francos",
  name: "FRANCOS",
  subtitle: "SEÑORES DE LA CABALLERÍA",
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
      ["Producir","Elegí hexagonos para producir."],
      ["Mover","Mueve hasta 2 unidades según su movilidad."],
      ["Construir","Utiliza un aldeano para construir estructuras disponibles."],
      ["Entrenar","Entrena tantas unidades económicas disponibles como puedas pagar."],
      ["Comerciar","Intercambia hasta 2 recursos utilizando el mercado."]
    ],
    technology: [
      ["Investigar","Investiga tecnologías disponibles."],
      ["Avanzar de Edad","Paga los requisitos y desbloquea la siguiente edad."],
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
      ["Mover","Mueve hasta 2 unidades según su movilidad."],
      ["Entrenar","Entrena tantas unidades militares disponibles como puedas pagar."],
      {name:"Instruir", cost:{gold:1}, text:"Obtén +1 poder de pelea."}
    ]
  },
  unitReference: {
    units: [
      {name:"Aldeano", force:0, range:0, move:1},
      {name:"Milicia", force:2, range:0, move:1, forceUpgrade:1},
      {name:"Arquero", force:1, range:1, move:1},
      {name:"Piquero", force:1, range:0, move:1},
      {name:"Jinete", force:2, range:0, move:2},
      {name:"Galera", force:2, range:0, move:1},
      {name:"Caballero", force:3, range:0, move:2, forceUpgrade:1},
      {name:"Escorpión", force:1, range:1, move:0},
      {name:"Trebuchet", force:1, range:3, move:0},
      {name:"Monje", force:0, range:1, move:1}
    ],
    upgrades: [
      {name:"Hombre de Armas", text:"Milicia +1 Fuerza."},
      {name:"Caballería Pesada", text:"Caballero +1 Fuerza."}
    ],
    abilities: [
      {name:"Caballería — Carga", text:"Requiere Carga. Unidades montadas que entren a un hexágono enemigo y peleen obtienen +1 Fuerza ese turno."},
      {name:"Monje — Conversión", text:"Si vencés una batalla en la que participaron Monjes, elegí 1 unidad enemiga derrotada por cada Monje participante. Las unidades elegidas pasan a tu control."}
    ],
    bonuses: [
      {from:"Piquero", to:"Caballería"},
      {from:"Piquero", to:"Milicia", green:true},
      {from:"Escorpión", to:"Infantería a pie"},
      {from:"Trebuchet", to:"Edificios (+2)"}
    ]
  },
  buildings: [
    {id:"tc", name:"Centro Urbano", image:"assets/buildings/centro-urbano.png"},
    {id:"mill", name:"Campamento Productivo", image:"assets/buildings/molino.png", cost:{wood:3}},
    {id:"port", name:"Puerto", image:"assets/buildings/puerto.png", cost:{wood:4,stone:2}},
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
    {age:"dark", building:"mill", type:"building", title:"Granja", cost:{wood:2}, text:"Produce 2 Comidas. Construcción sobre Llanura."},
    {age:"dark", building:"port", type:"civil", title:"Pesquero", cost:{wood:2}},
    {age:"dark", building:"port", type:"civil", title:"Barco de Transporte", stats:{move:2}, cost:{wood:3}, text:"Unidad capaz de transportar hasta 6 unidades."},
    {age:"dark", building:"barracks", type:"unit", title:"Milicia", cost:{food:1,gold:1}},
    {age:"dark", building:"barracks", type:"unit", title:"Arquero", cost:{food:1,wood:2,gold:1}},
    {age:"dark", building:"barracks", type:"tech", title:"Hombre de Armas", cost:{food:2,gold:1}, text:"Tu milicia gana +1 de fuerza."},
    {age:"dark", building:"tower", type:"tech", title:"Vigía", cost:{wood:1,stone:1}, text:"La Torre aporta +1 Fuerza a las batallas en su propio hexágono."},

    {age:"dark", building:"tc", type:"tech", title:"Carretilla", cost:{wood:1,gold:1}, text:"Los Aldeanos pueden transportar recursos al MOVER."},
    {age:"dark", building:"tc", type:"tech", title:"Telar", cost:{food:1,wood:1}, text:"Tus aldeanos adquieren +1 Fuerza. Ahora pueden entrar a la batalla."},
    {age:"feudal", building:"tc", type:"tech", title:"Colonización", cost:{food:2,wood:2}, text:"Un Aldeano entrenado puede salir en un hexágono adyacente."},
    {age:"feudal", building:"tc", type:"tech", title:"Conscripción", cost:{food:2,gold:1}, text:"La primera Milicia entrenada cada turno cuesta 1 Comida menos."},
    {age:"feudal", building:"mill", type:"tech", title:"Rot. de Cultivos", cost:{food:2,wood:1}, text:"Las Granjas no tienen costo de construcción."},
    {age:"feudal", building:"port", type:"tech", title:"Redes de Carga", cost:{wood:4}, text:"Cada Pesquero puede PRODUCIR en su hexágono de Agua y en otro hexágono de Agua adyacente. Los recursos quedan en el hexágono donde se producen."},
    {age:"dark", building:"mill", type:"tech", title:"Doble Filo", cost:{food:1,gold:1,stone:1}, text:"Aldeanos trabajando en el bosque producen +1 madera."},
    {age:"feudal", building:"barracks", type:"unit", title:"Piquero", cost:{food:2,wood:1}},
    {age:"feudal", building:"barracks", type:"tech", title:"Hoplomachus", cost:{food:2,gold:1}, text:"El Piquero obtiene bonus contra Milicia."},
    {age:"feudal", building:"tower", type:"tech", title:"Muralla", cost:{wood:2,stone:2}, text:"Fortificar puede pagarse con 2 piedra en lugar de madera."},
    {age:"castles", building:"port", type:"unit", title:"Galera", cost:{wood:3,gold:1}},
    {age:"castles", building:"port", type:"tech", title:"Astillero", cost:{wood:3,gold:2}, text:"Barcos entrenados pueden salir en un hexágono de Agua adyacente al Puerto."},
    {age:"imperial", building:"port", type:"tech", title:"Desembarco", cost:{wood:3,food:2}, text:"Unidades transportadas se pueden mover 1 hexágono al desembarcar."},
    {age:"feudal", building:"mill", type:"tech", title:"Canteros", cost:{food:2,wood:1}, text:"Aldeanos trabajando en una cantera de piedra producen +1 piedra."},
    {age:"castles", building:"tc", type:"tech", title:"Herrería", cost:{food:2,stone:2,gold:2}, text:"La primera unidad militar que entrenes cada turno cuesta 1 Oro menos."},
    {age:"castles", building:"barracks", type:"unit", title:"Jinete", cost:{food:2,gold:3}},
    {age:"castles", building:"barracks", type:"unit", title:"Caballero", cost:{food:3,gold:4}},
    {age:"castles", building:"barracks", type:"tech", title:"Carga", cost:{food:2,gold:2}, text:"Unidades montadas que entren a un hexágono enemigo y peleen obtienen +1 Fuerza ese turno."},
    {age:"castles", building:"tower", type:"military-building", title:"Castillo", cost:{stone:4,gold:2}, text:"+1 Fuerza en batallas a 1 hexágono. Unidad disponible: Caballero."},
    {age:"castles", building:"tower", type:"tech", title:"Señorío", cost:{food:2,gold:2}, text:"Jinetes y Caballeros pueden entrenarse en el Castillo."},
    {age:"castles", building:"tc", type:"military-building", title:"Monasterio", cost:{wood:3,stone:2}, text:"Construcción necesaria para guardar reliquias. Unidad disponible: Monje."},

    {age:"imperial", building:"tc", type:"tech", title:"Administración Real", cost:{food:4,gold:3}, text:"Tus construcciones producen +1 recurso."},
    {age:"imperial", building:"barracks", type:"tech", title:"Caballería Pesada", cost:{food:4,gold:4}, text:"Los Caballeros obtienen +1 Fuerza."},
    {age:"imperial", building:"mill", type:"tech", title:"Excedentes", cost:{food:3,gold:2}, text:"Una vez por turno, podés convertir 2 Comidas de tu territorios controlados en 1 Oro, sin gastar una acción."},
    {age:"castles", building:"mill", type:"military-building", title:"Asedio", cost:{wood:4,stone:2,gold:2}, text:"Construí maquinaria que da bonus contra unidades y edificios. Unidad disponible: Escorpión y Trebuchet. Requiere una unidad a pie para trasladarla y un Aldeano para operarla."},
    {age:"imperial", building:"mill", type:"tech", title:"Ingeniería", cost:{wood:3,gold:3}, text:"Escorpiones entrenados pueden salir en un hexágono adyacente."},
    {age:"imperial", building:"barracks", type:"tech", title:"Movilización", cost:{food:3,gold:3}, text:"Al entrenar una unidad de caballería, podés colocarla en cualquier construcción militar propia."},
    {age:"imperial", building:"tower", type:"tech", title:"Saqueo", cost:{food:2,gold:3}, text:"Al ganar una batalla, podés llevarte 2 recursos del hexágono enemigo con tu ejército."},
    {age:"imperial", building:"tower", type:"tech", title:"Vasallaje", cost:{food:3,gold:3}, text:"Caballería adyacente al Castillo puede usarlo como punto de entrenamiento."},
    {age:"imperial", building:"tc", type:"tech", title:"Herejía", cost:{gold:5}, text:"Unidades convertidas por monjes enemigos mueren en lugar de cambiar de bando."}
  ]
};
