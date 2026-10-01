window.PLAYER_MAT_CIVS = window.PLAYER_MAT_CIVS || {};
window.PLAYER_MAT_CIVS.britanicos = {
  id: "britanicos",
  name: "BRITÁNICOS",
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
      ["Construir","Construí un edificio o mejora de terreno disponible."],
      ["Entrenar","Entrená un aldeano en el Centro Urbano o Molino."],
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
      ["Entrenar","Entrená una unidad militar disponible (cuadro azul)."],
      ["Instruir","Obtené +1 Poder de pelea."]
    ]
  },
  buildings: [
    {id:"tc", name:"Centro Urbano", image:"assets/buildings/centro-urbano.jpg"},
    {id:"mill", name:"Molino", image:"assets/buildings/molino.jpg"},
    {id:"port", name:"Puerto", image:"assets/buildings/puerto.jpg"},
    {id:"camp", name:"Campamento de Recursos", image:"assets/buildings/campamento-recursos.jpg"},
    {id:"barracks", name:"Cuartel", image:"assets/buildings/cuartel.jpg"},
    {id:"tower", name:"Torre", image:"assets/buildings/torre.jpg"},
    {id:"monastery", name:"Monasterio", image:"assets/buildings/monasterio.jpg", unlock:"castles"}
  ],
  ages: [
    {id:"dark", roman:"I", name:"ALTA EDAD MEDIA", image:"assets/ages/alta-centro-urbano.jpg"},
    {id:"feudal", roman:"II", name:"EDAD FEUDAL", image:"assets/ages/feudal-centro-urbano.jpg", cost:{food:4,wood:2,stone:1,gold:1}},
    {id:"castles", roman:"III", name:"EDAD DE LOS CASTILLOS", image:"assets/ages/castillos-web.jpg", cost:{food:6,wood:4,stone:2,gold:2}},
    {id:"imperial", roman:"IV", name:"EDAD IMPERIAL", image:"assets/ages/imperial.png", cost:{food:8,wood:6,stone:4,gold:5}}
  ],
  nodes: [
    {age:"dark", building:"tc", type:"civil", title:"Aldeano", cost:{food:1}, text:"Unidad necesaria para producir y construir."},
    {age:"dark", building:"mill", type:"civil", title:"Aldeano", cost:{food:2}, text:"Unidad necesaria para producir y construir."},
    {age:"dark", building:"mill", type:"building", title:"Granja", cost:{wood:2}, text:"Produce 1 Comida. Puede construirse sobre Llanura."},
    {age:"dark", building:"port", type:"civil", title:"Pesquero", cost:{wood:2}, text:"Unidad necesaria para producir."},
    {age:"dark", building:"port", type:"civil", title:"Barco de Transporte", stats:{move:2}, cost:{wood:3}, text:"Unidad capaz de transportar unidades y recursos sin límite de capacidad."},
    {age:"dark", building:"barracks", type:"unit", title:"Milicia", stats:{force:2,range:0,move:1}, cost:{food:1,gold:1}},
    {age:"dark", building:"barracks", type:"unit", title:"Arquero", stats:{force:2,range:1,move:1}, cost:{wood:1,gold:1}},
    {age:"dark", building:"tower", type:"tech", title:"Guarnición", cost:{food:2,wood:1}, text:"Las unidades de arquería pueden guarecerse en la Torre."},

    {age:"dark", building:"tc", type:"tech", title:"Carretilla", cost:{wood:1,gold:1}, text:"Los aldeanos pueden transportar +1 recurso."},
    {age:"feudal", building:"tc", type:"tech", title:"Telar", cost:{food:1,wood:1}, text:"Tus aldeanos adquieren +1 Fuerza. Ahora pueden entrar a la batalla."},
    {age:"feudal", building:"mill", type:"tech", title:"Pastoreo", cost:{food:1,wood:1}, text:"La comida de ANIMALES puede utilizarse desde cualquier hexágono."},
    {age:"castles", building:"mill", type:"building", title:"Mercado", cost:{wood:3}, text:"Habilita comerciar entre jugadores. Todo comercio debe incluir Oro."},
    {age:"feudal", building:"port", type:"tech", title:"Trampa para peces", cost:{wood:2}, text:"Los pesqueros producen +1 Comida."},
    {age:"feudal", building:"camp", type:"tech", title:"Hacha de Doble Filo", cost:{food:1,wood:1}, text:"Los leñadores producen +1 Madera."},
    {age:"feudal", building:"barracks", type:"unit", title:"Escaramuzador", stats:{force:1,range:1,move:1}, cost:{food:1,wood:1}, text:"Escudo de madera y lanza."},
    {age:"feudal", building:"barracks", type:"tech", title:"Marcha Disciplinada", cost:{food:2,gold:1}, text:"Las unidades de arquería recién entrenadas pueden mover 1 hexágono."},

    {age:"castles", building:"tc", type:"tech", title:"Desarrollo", cost:{food:3,gold:2}, text:"Recuperás el 50% de los recursos que gastaste para alcanzar tu Edad actual."},
    {age:"castles", building:"port", type:"tech", title:"Navegación Avanzada", cost:{wood:2,gold:1}, text:"Pesqueros y transportes pueden llevar 8 recursos."},
    {age:"castles", building:"camp", type:"tech", title:"Explotación Aurífera", cost:{food:2,wood:1}, text:"Los mineros producen +1 Oro."},
    {age:"castles", building:"barracks", type:"unit", title:"Jinete", stats:{force:2,range:0,move:2}, cost:{food:2,gold:1}},
    {age:"castles", building:"barracks", type:"tech", title:"Yeomen", cost:{food:2,gold:2}, text:"Todas las unidades de arquería obtienen +1 Fuerza."},
    {age:"castles", building:"tower", type:"building", title:"Castillo", cost:{stone:5,gold:2}},
    {age:"castles", building:"tower", type:"unit", title:"Arquero de Tiro Largo", stats:{force:3,range:2,move:1}, cost:{wood:2,gold:1}},
    {age:"castles", building:"monastery", type:"unit", title:"Monje", stats:{force:1,range:1,move:1}, cost:{gold:3}},

    {age:"imperial", building:"tc", type:"tech", title:"Administración", cost:{food:4,gold:3}, text:"Tus construcciones producen +1 recurso."},
    {age:"imperial", building:"mill", type:"tech", title:"Carreta Mercante", cost:{wood:3,gold:2}, text:"Podés mover hasta 6 recursos de un hexágono de manera instantánea a otro hexágono que contenga una construcción."},
    {age:"imperial", building:"barracks", type:"tech", title:"Levas de Arqueros", cost:{food:3,gold:3}, text:"Al ENTRENAR, podés entrenar hasta 2 unidades de arquería en lugar de 1."},
    {age:"imperial", building:"tower", type:"tech", title:"Élite", cost:{food:3,gold:3}, text:"Los Arqueros de Tiro Largo obtienen +1 Fuerza."},
    {age:"imperial", building:"monastery", type:"tech", title:"Herejía", cost:{gold:5}, text:"Las unidades convertidas por tus monjes mueren en lugar de pasarse de bando."}
  ]
};
