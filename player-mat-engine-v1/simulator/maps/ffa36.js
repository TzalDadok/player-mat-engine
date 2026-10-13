import { hexDistance } from '../engine/hex.js';

const DIRS = [
  [1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]
];

const PRIMARY_TYPES = ['forest','animals','berries','gold','stone'];
const SECONDARY_TYPES = ['water','desert','plain','mountain'];

function key(q,r){ return `${q},${r}`; }

function mulberry32(seed){
  let a=seed>>>0;
  return ()=>{
    a|=0;
    a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

export function hashSeed(seed){
  if(typeof seed==='number') return seed>>>0;
  let h=2166136261;
  for(const ch of String(seed??'aevum')){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

function shuffle(values,rand){
  const a=[...values];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(rand()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function ring(radius){
  if(radius===0) return [{q:0,r:0}];
  const cells=[];
  let q=-radius,r=radius;
  for(let side=0;side<6;side++){
    const [dq,dr]=DIRS[side];
    for(let step=0;step<radius;step++){
      cells.push({q,r});
      q+=dq;r+=dr;
    }
  }
  return cells;
}

function emptyHex(id,q,r){
  return {
    id,q,r,
    terrain:'plain',
    source:null,
    category:null,
    looseResources:[],
    special:null,
    tcOwnerId:null,
    waterLane:null,
    palisades:[],
    productionHistory:{},
    explored:false,
    relics:0
  };
}

export function createFFAPlayerPiles(playerId,seed){
  const rand=mulberry32(hashSeed(`${seed}:piles:${playerId}`));

  const primary=[];
  for(const type of PRIMARY_TYPES){
    primary.push({category:'primary',type},{category:'primary',type});
  }

  // Cada jugador posee dos Aguas. Se modelan una A y una B para respetar
  // la regla naval A↔B sin alterar que ambas sean el mismo terreno secundario.
  const secondary=[
    {category:'secondary',type:'water',waterLane:'A'},
    {category:'secondary',type:'water',waterLane:'B'}
  ];
  for(const type of SECONDARY_TYPES.filter(x=>x!=='water')){
    secondary.push({category:'secondary',type},{category:'secondary',type});
  }

  return {
    primary:shuffle(primary,rand),
    secondary:shuffle(secondary,rand)
  };
}

function normalizeBuilders(players=[]){
  const normalized=players.map((p,i)=>
    typeof p==='string'
      ? {id:p,seat:i+1}
      : {id:p.id||`P${i+1}`,seat:i+1,...p}
  );

  // El setup físico descrito es de cuatro jugadores. Los puestos MAP-* sólo
  // permiten reutilizar el tablero en experimentos 1v1/3p de Hito 3.
  while(normalized.length<4){
    const i=normalized.length;
    normalized.push({id:`MAP-${i+1}`,seat:i+1,virtualMapBuilder:true});
  }

  return normalized.slice(0,4);
}

export function placementCategoryFor(playerIndex,ownTurnIndex){
  const startsPrimary=playerIndex%2===0; // J1/J3 P; J2/J4 S.
  const primaryThisTurn=ownTurnIndex%2===0 ? startsPrimary : !startsPrimary;
  return primaryThisTurn ? 'primary' : 'secondary';
}

function randomPlacementPolicy({availableCoords,random}){
  return availableCoords[Math.floor(random()*availableCoords.length)];
}

function sameCoord(a,b){ return a&&b&&a.q===b.q&&a.r===b.r; }

export function generateFFAMap({
  rings=3,
  seed='aevum-ffa',
  players=['P1','P2','P3','P4'],
  placementPolicy=randomPlacementPolicy
}={}){
  if(![3,4].includes(rings)) throw new Error('FFA experimental admite 3 o 4 gradas.');
  const builders=normalizeBuilders(players);
  const mapRandom=mulberry32(hashSeed(`${seed}:placement`));
  const piles=new Map(
    builders.map(p=>[p.id,createFFAPlayerPiles(p.id,seed)])
  );
  const ownTurns=new Map(builders.map(p=>[p.id,0]));

  const wonder=emptyHex('W',0,0);
  wonder.special='wonder';
  wonder.category='special';

  const hexes=[wonder];
  const placementHistory=[];
  let placementNumber=0;

  for(let radius=1;radius<=rings;radius++){
    const available=ring(radius).map(coord=>({...coord}));

    while(available.length){
      const playerIndex=placementNumber%4;
      const player=builders[playerIndex];
      const ownTurnIndex=ownTurns.get(player.id);
      const category=placementCategoryFor(playerIndex,ownTurnIndex);
      const pile=piles.get(player.id)[category];
      const tile=pile.shift();

      if(!tile){
        throw new Error(`${player.id} se quedó sin hexágonos ${category} durante la generación FFA.`);
      }

      const choice=placementPolicy({
        seed:String(seed),
        player:{...player},
        playerIndex,
        ownTurnIndex,
        placementNumber:placementNumber+1,
        radius,
        category,
        tile:{...tile},
        availableCoords:available.map(c=>({...c})),
        placedHexes:hexes.map(h=>({...h})),
        history:placementHistory.map(x=>({...x})),
        random:mapRandom
      });

      const pos=available.find(c=>sameCoord(c,choice));
      if(!pos){
        throw new Error('La política de colocación eligió una posición inválida para la grada actual.');
      }

      available.splice(available.indexOf(pos),1);

      const id=`T${String(placementNumber+1).padStart(2,'0')}`;
      const h=emptyHex(id,pos.q,pos.r);
      h.category=category;
      h.placedBy=player.id;
      h.placementNumber=placementNumber+1;
      h.ring=radius;

      if(category==='primary'){
        h.source=tile.type;
        h.terrain=tile.type==='forest'?'forest':'plain';
      }else{
        h.terrain=tile.type;
        h.source=null;
        h.waterLane=tile.waterLane||null;
      }

      hexes.push(h);
      placementHistory.push({
        placementNumber:placementNumber+1,
        ring:radius,
        playerId:player.id,
        playerIndex,
        ownTurnIndex,
        category,
        type:tile.type,
        waterLane:tile.waterLane||null,
        hexId:id,
        q:pos.q,
        r:pos.r
      });

      ownTurns.set(player.id,ownTurnIndex+1);
      placementNumber++;
    }
  }

  const expected=3*rings*(rings+1);
  if(placementNumber!==expected){
    throw new Error(`El FFA debe completar ${expected} terrenos y generó ${placementNumber}.`);
  }

  const discarded=Object.fromEntries(builders.map(player=>{
    const p=piles.get(player.id);
    return [player.id,{
      primary:p.primary.map(x=>({...x})),
      secondary:p.secondary.map(x=>({...x}))
    }];
  }));

  return {
    mode:'ffa',
    preset:`ffa${3*rings*(rings+1)}`,
    seed:String(seed),
    builders:builders.map(x=>({...x})),
    hexes,
    terrainIds:hexes.filter(h=>!h.special).map(h=>h.id),
    perimeterIds:hexes.filter(h=>!h.special&&hexDistance(h,wonder)===rings).map(h=>h.id),
    placementHistory,
    discarded
  };
}

export function generateFFA36Map(options={}){
  return generateFFAMap({...options,rings:3});
}

export function generateFFA60Map(options={}){
  return generateFFAMap({...options,rings:4});
}

function freeOuterNeighbor(hexes,anchor){
  const occupied=new Set(hexes.map(h=>key(h.q,h.r)));
  const existingCUs=hexes.filter(h=>h.special==='tc');

  const candidates=DIRS
    .map(([dq,dr])=>({q:anchor.q+dq,r:anchor.r+dr}))
    .filter(c=>!occupied.has(key(c.q,c.r)))
    .filter(c=>existingCUs.every(cu=>hexDistance(c,cu)>=2))
    .sort((a,b)=>hexDistance(b,{q:0,r:0})-hexDistance(a,{q:0,r:0}));

  return candidates[0]||null;
}

export function placeFFAPlayerCU(map,playerId,anchorTerrainId){
  const anchor=map.hexes.find(h=>h.id===anchorTerrainId);
  if(!anchor||!map.perimeterIds.includes(anchorTerrainId)){
    throw new Error('El CU debe elegirse junto a un territorio del perímetro exterior.');
  }
  if(map.hexes.some(h=>h.special==='tc'&&h.tcAnchorId===anchorTerrainId)){
    throw new Error('Esa posición exterior ya tiene un CU.');
  }

  const pos=freeOuterNeighbor(map.hexes,anchor);
  if(!pos){
    throw new Error('No hay una posición exterior legal para el CU: debe quedar fuera del mapa y a distancia mínima 2 de cualquier otro CU.');
  }

  const cu=emptyHex(`CU-${playerId}`,pos.q,pos.r);
  cu.special='tc';
  cu.category='special';
  cu.tcOwnerId=playerId;
  cu.tcAnchorId=anchorTerrainId;
  map.hexes.push(cu);
  return cu;
}

function hasPermanentLandPathToWonder(map,startId){
  const start=map.hexes.find(h=>h.id===startId);
  const wonder=map.hexes.find(h=>h.special==='wonder');
  if(!start||!wonder||start.terrain==='water'||['gold','stone'].includes(start.source)) return false;

  const queue=[start.id];
  const seen=new Set(queue);

  while(queue.length){
    const id=queue.shift();
    if(id===wonder.id) return true;
    const current=map.hexes.find(h=>h.id===id);

    for(const candidate of map.hexes){
      if(
        candidate.terrain==='water'||
        ['gold','stone'].includes(candidate.source)||
        seen.has(candidate.id)||
        hexDistance(current,candidate)!==1
      ) continue;

      seen.add(candidate.id);
      queue.push(candidate.id);
    }
  }

  return false;
}

function hasLandPathToWonder(map,startId){
  const start=map.hexes.find(h=>h.id===startId);
  const wonder=map.hexes.find(h=>h.special==='wonder');
  if(!start||!wonder||start.terrain==='water') return false;

  const queue=[start.id];
  const seen=new Set(queue);

  while(queue.length){
    const id=queue.shift();
    if(id===wonder.id) return true;
    const current=map.hexes.find(h=>h.id===id);

    for(const candidate of map.hexes){
      if(
        candidate.terrain==='water'||
        seen.has(candidate.id)||
        hexDistance(current,candidate)!==1
      ) continue;
      seen.add(candidate.id);
      queue.push(candidate.id);
    }
  }

  return false;
}

function startResourceValue(hex,distance){
  if(!hex) return 0;

  const base={
    forest:5,
    animals:5,
    berries:4,
    gold:2.5,
    stone:2
  }[hex.source]||0;

  const terrain=
    hex.terrain==='water'?0.5:
    hex.terrain==='mountain'?-0.5:
    hex.terrain==='desert'?-0.25:
    0;

  const factor=distance===0?1.35:distance===1?1:0.45;
  return (base+terrain)*factor;
}

function startArea(map,anchor){
  return map.hexes.filter(h=>!h.special&&hexDistance(anchor,h)<=2);
}

export function scoreFFAStartAnchor(map,anchorId,chosenAnchorIds=[]){
  const anchor=map.hexes.find(h=>h.id===anchorId);
  if(
    !anchor||
    !map.perimeterIds.includes(anchorId)||
    anchor.terrain==='water'||
    !hasLandPathToWonder(map,anchorId)||
    !freeOuterNeighbor(map.hexes,anchor)
  ) return -Infinity;

  let score=0;
  const area=startArea(map,anchor);
  const nearbyResources=new Set();

  for(const h of area){
    const d=hexDistance(anchor,h);
    score+=startResourceValue(h,d);
    if(h.source) nearbyResources.add(h.source);
  }

  const hasFood=nearbyResources.has('animals')||nearbyResources.has('berries');
  const hasWood=nearbyResources.has('forest');
  if(hasFood&&hasWood) score+=7;
  if(nearbyResources.has('gold')) score+=1.5;
  if(nearbyResources.has('stone')) score+=1.5;
  score+=nearbyResources.size*0.75;

  if(['gold','stone'].includes(anchor.source)) score-=12;
  if(hasPermanentLandPathToWonder(map,anchorId)) score+=10;
  else score-=18;

  for(const otherId of chosenAnchorIds){
    const other=map.hexes.find(h=>h.id===otherId);
    if(!other) continue;
    const d=hexDistance(anchor,other);
    if(d<=2) score-=8;
    else if(d===3) score-=3;
  }

  return score;
}

function startTieBreak(map,playerId,anchorId){
  return hashSeed(`${map.seed}:start:${playerId}:${anchorId}`)/0xffffffff;
}

export function chooseFFAStartAnchor(map,playerId,chosenAnchorIds=[]){
  const candidates=map.perimeterIds
    .filter(id=>!chosenAnchorIds.includes(id))
    .map(id=>({
      id,
      score:scoreFFAStartAnchor(map,id,chosenAnchorIds),
      tie:startTieBreak(map,playerId,id)
    }))
    .filter(x=>Number.isFinite(x.score))
    .sort((a,b)=>b.score-a.score||b.tie-a.tie);

  if(!candidates.length){
    throw new Error('No hay una posición exterior válida para el Centro Urbano.');
  }

  return candidates[0];
}

export function autoPlaceFFAPlayerCUs(
  map,
  players,
  { selectionOrder = null } = {}
){
  const normalized=(players||[]).map((player,i)=>
    typeof player==='string'
      ? {id:player,order:i}
      : {id:player.id||`P${i+1}`,...player,order:i}
  );

  if(normalized.length<2||normalized.length>4){
    throw new Error('FFA admite 2 a 4 jugadores.');
  }

  const byId=new Map(normalized.map(p=>[p.id,p]));
  const orderIds=selectionOrder || normalized.map(p=>p.id);

  if(
    orderIds.length!==normalized.length ||
    new Set(orderIds).size!==normalized.length ||
    orderIds.some(id=>!byId.has(id))
  ){
    throw new Error('El orden de selección de CU debe contener exactamente una vez a cada jugador.');
  }

  const chosen=[];
  const placements=[];

  for(const playerId of orderIds){
    const player=byId.get(playerId);
    const choice=chooseFFAStartAnchor(map,player.id,chosen);
    chosen.push(choice.id);
    const cu=placeFFAPlayerCU(map,player.id,choice.id);
    cu.startScore=choice.score;
    cu.selectionIndex=placements.length+1;
    placements.push(cu);
  }

  return placements;
}
