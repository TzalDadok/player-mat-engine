window.PLAYER_MAT_CIVS = window.PLAYER_MAT_CIVS || {};
window.PLAYER_MAT_CIVS.britanicos = {
  id: "britanicos",
  name: "BRITÁNICOS",
  subtitle: "MAESTROS DEL ARCO",
  motto: "Disciplina, alcance\ny control del territorio.",
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
      ["Construir","Construí un edificio o mejora de terreno disponible."],
      ["Entrenar (Aldeano)","Entrená un aldeano en el Centro Urbano o Molino."],
      ["Comerciar","Realizá un intercambio utilizando oro, si existe un Mercado."]
    ],
    technology: [
      ["Investigar","Adquirí una tecnología disponible (cuadro verde)."],
      ["Avanzar de Edad","Pagá los requisitos y desbloqueá la siguiente línea del árbol."]
    ],
    military: [
      ["Mover","Mové unidades militares. Entrar en un hexágono enemigo puede iniciar combate."],
      ["Entrenar (Unidad)","Entrená una unidad militar disponible (cuadro azul)."]
    ]
  },
  buildings: [
    {id:"tc", name:"Centro Urbano", image:"assets/buildings/centro-urbano.jpg"},
    {id:"mill", name:"Molino", image:"assets/buildings/molino.jpg"},
    {id:"port", name:"Puerto", image:"assets/buildings/puerto.jpg"},
    {id:"camp", name:"Campamento de Recursos", image:"assets/buildings/campamento-recursos.jpg"},
    {id:"barracks", name:"Cuartel", image:"assets/buildings/cuartel.jpg"},
    {id:"tower", name:"Torre", image:"assets/buildings/torre.jpg"},
    {id:"castle", name:"Castillo", image:"assets/buildings/castillo.jpg", unlock:"castles"},
    {id:"monastery", name:"Monasterio", image:"assets/buildings/monasterio.jpg", unlock:"castles"}
  ],
  ages: [
    {id:"dark", roman:"I", name:"ALTA\nEDAD MEDIA", image:"assets/ages/alta.jpg", advance:{label:"Pasar a Feudal", cost:{food:4,wood:4,stone:2,gold:2}}},
    {id:"feudal", roman:"II", name:"EDAD\nFEUDAL", image:"assets/ages/feudal.jpg", advance:{label:"Pasar a Castillos", cost:{food:5,wood:6,stone:4,gold:3}}},
    {id:"castles", roman:"III", name:"EDAD DE LOS\nCASTILLOS", image:"assets/ages/castillos.jpg", advance:{label:"Pasar a Imperial", cost:{food:8,wood:8,stone:6,gold:6}}},
    {id:"imperial", roman:"IV", name:"EDAD\nIMPERIAL", image:"assets/ages/imperial.jpg"}
  ],
  nodes: [
    {age:"dark", building:"tc", type:"unit", title:"Aldeano", stats:{force:1,range:0,move:1}, cost:{food:50}},
    {age:"dark", building:"mill", type:"unit", title:"Aldeano (Molino)", stats:{force:1,range:0,move:1}, cost:{food:75,stone:25}},
    {age:"dark", building:"mill", type:"building", title:"Granja", cost:{food:60,wood:20}, text:"Produce 1 Comida."},
    {age:"dark", building:"port", type:"unit", title:"Pesquero", stats:{force:2,range:0,move:0}, cost:{food:60,stone:20,gold:20}},
    {age:"dark", building:"port", type:"unit", title:"Barco de Transporte", stats:{force:3,range:0,move:2}, cost:{food:100,stone:50}},
    {age:"dark", building:"barracks", type:"unit", title:"Milicia", stats:{force:2,range:0,move:1}, cost:{food:60}},
    {age:"dark", building:"barracks", type:"unit", title:"Arquero", stats:{force:2,range:1,move:1}, cost:{food:60,gold:30}},
    {age:"dark", building:"tower", type:"tech", title:"Guarnición", cost:{food:80,wood:40}, text:"Las unidades de arquería pueden guarecerse en la Torre."},

    {age:"feudal", building:"tc", type:"tech", title:"Carretilla", cost:{food:50,gold:0}, text:"Los aldeanos pueden transportar +1 recurso."},
    {age:"feudal", building:"mill", type:"tech", title:"Pastoreo", cost:{food:75,wood:50}, text:"La comida de ANIMALES puede utilizarse desde cualquier hexágono."},
    {age:"feudal", building:"mill", type:"building", title:"Mercado", cost:{food:150,wood:75}, text:"Habilita COMERCIAR."},
    {age:"feudal", building:"port", type:"tech", title:"Trampa para peces", cost:{food:75,wood:50}, text:"Los pesqueros producen +1 Comida."},
    {age:"feudal", building:"camp", type:"tech", title:"Hacha de Doble Filo", cost:{food:75,wood:50}, text:"Los leñadores producen +1 Madera."},
    {age:"feudal", building:"barracks", type:"unit", title:"Escaramuzador", stats:{force:1,range:1,move:1}, cost:{wood:30}, text:"Escudo de madera y lanza."},
    {age:"feudal", building:"barracks", type:"tech", title:"Marcha Disciplinada", cost:{food:75,wood:50}, text:"Las unidades de arquería recién entrenadas pueden mover 1 hexágono."},

    {age:"castles", building:"tc", type:"tech", title:"Desarrollo", cost:{food:200,wood:200}, text:"Recuperás el 50% de los recursos que gastaste para alcanzar tu Edad actual."},
    {age:"castles", building:"port", type:"tech", title:"Red de Pesca", cost:{food:125,wood:75}, text:"Los pesqueros producen +1 Comida adicional."},
    {age:"castles", building:"port", type:"tech", title:"Navegación Avanzada", cost:{food:200,wood:100}, text:"Pesqueros y transportes pueden llevar 8 recursos."},
    {age:"castles", building:"camp", type:"tech", title:"Explotación Aurífera", cost:{food:125,wood:75}, text:"Los mineros producen +1 Oro."},
    {age:"castles", building:"barracks", type:"unit", title:"Jinete", stats:{force:2,range:0,move:2}, cost:{food:120,wood:70}},
    {age:"castles", building:"barracks", type:"tech", title:"Yeomen", cost:{food:100,wood:100}, text:"Todas las unidades de arquería obtienen +1 Fuerza."},
    {age:"castles", building:"castle", type:"unit", title:"Arquero de Tiro Largo", stats:{force:3,range:2,move:1}, cost:{food:150,wood:100}},
    {age:"castles", building:"monastery", type:"unit", title:"Monje", stats:{force:1,range:1,move:1}, cost:{food:100,stone:50}},

    {age:"imperial", building:"tc", type:"tech", title:"Administración Real", cost:{food:300,wood:200}, text:"Tus aldeanos producen +1 recurso del tipo del edificio donde trabajan."},
    {age:"imperial", building:"mill", type:"unit", title:"Carreta Mercante", cost:{food:200,wood:100}, text:"Mueve hasta 6 recursos instantáneamente a cualquier hexágono con edificio.", tag:"Mercado"},
    {age:"imperial", building:"barracks", type:"tech", title:"Levas de Arqueros", cost:{food:200,wood:150}, text:"Al ENTRENAR, podés entrenar hasta 2 unidades de arquería en lugar de 1."},
    {age:"imperial", building:"castle", type:"tech", title:"Élite", cost:{food:150,wood:150}, text:"Los Arqueros de Tiro Largo obtienen +1 Fuerza."},
    {age:"imperial", building:"monastery", type:"tech", title:"Herejía", cost:{food:200,wood:200}, text:"Las unidades convertidas por tus monjes mueren en lugar de pasarse de bando."}
  ]
};
