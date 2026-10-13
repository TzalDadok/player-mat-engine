import { hexDistance } from '../engine/hex.js';

const DIRS = [
  [1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]
];

function key(q,r){ return `${q},${r}`; }

function mulberry32(seed){
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(seed){
  if (typeof seed === 'number') return seed >>> 0;
  const s=String(seed ?? 'aevum');
  let h=2166136261;
  for(const ch of s){
    h ^= ch.charCodeAt(0);
    h = Math.imul(h,16777619);
  }
  return h >>> 0;
}

function shuffle(values, rand){
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
  let q=-radius, r=radius;
  for(let side=0;side<6;side++){
    const [dq,dr]=DIRS[side];
    for(let step=0;step<radius;step++){
      cells.push({q,r});
      q+=dq; r+=dr;
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

export const DEFAULT_FFA_PRIMARY_BAG = [
  ...Array(7).fill('forest'),
  ...Array(7).fill('animals'),
  ...Array(6).fill('berries'),
  ...Array(6).fill('gold'),
  ...Array(6).fill('stone')
];

export const DEFAULT_FFA_SECONDARY_BAG = [
  ...Array(4).fill('water'),
  ...Array(4).fill('desert'),
  ...Array(4).fill('plain'),
  ...Array(4).fill('mountain')
];

export function generateFFA48Map({
  seed='aevum-ffa',
  primaryBag=DEFAULT_FFA_PRIMARY_BAG,
  secondaryBag=DEFAULT_FFA_SECONDARY_BAG
}={}){
  if(primaryBag.length!==32) throw new Error('FFA requiere exactamente 32 primarios.');
  if(secondaryBag.length!==16) throw new Error('FFA requiere exactamente 16 secundarios.');

  const rand=mulberry32(hashSeed(seed));

  // 36 posiciones de los anillos 1-3 + 12 posiciones equidistantes del anillo 4.
  const inner=[...ring(1),...ring(2),...ring(3)];
  const outer4=ring(4);
  const selectedOuter=outer4.filter((_,i)=>i%2===0);
  const terrainCoords=[...inner,...selectedOuter];

  const deck=shuffle([
    ...primaryBag.map(type=>({category:'primary',type})),
    ...secondaryBag.map(type=>({category:'secondary',type}))
  ],rand);

  const wonder=emptyHex('W',0,0);
  wonder.special='wonder';
  wonder.category='special';

  const hexes=[wonder];
  terrainCoords.forEach((coord,i)=>{
    const tile=deck[i];
    const h=emptyHex(`T${String(i+1).padStart(2,'0')}`,coord.q,coord.r);
    h.category=tile.category;

    if(tile.category==='primary'){
      h.source=tile.type;
      h.terrain=tile.type==='forest' ? 'forest' : 'plain';
    }else{
      h.terrain=tile.type;
      h.source=null;
      if(tile.type==='water') h.waterLane = i%2 ? 'A' : 'B';
    }
    hexes.push(h);
  });

  return {
    mode:'ffa',
    seed:String(seed),
    hexes,
    terrainIds:hexes.filter(h=>h.category!=='special').map(h=>h.id),
    perimeterIds:hexes.filter(h=>h.category!=='special' && hexDistance(h,wonder)===4).map(h=>h.id)
  };
}

function freeOuterNeighbor(hexes, anchor){
  const occupied=new Set(hexes.map(h=>key(h.q,h.r)));
  const existingCUs=hexes.filter(h=>h.special==='tc');

  const candidates=DIRS
    .map(([dq,dr])=>({q:anchor.q+dq,r:anchor.r+dr}))
    .filter(c=>!occupied.has(key(c.q,c.r)))
    .filter(c=>existingCUs.every(cu=>hexDistance(c,cu)>=2))
    .sort((a,b)=>hexDistance(b,{q:0,r:0})-hexDistance(a,{q:0,r:0}));

  return candidates[0] || null;
}

export function placeFFAPlayerCU(map, playerId, anchorTerrainId){
  const anchor=map.hexes.find(h=>h.id===anchorTerrainId);
  if(!anchor || !map.perimeterIds.includes(anchorTerrainId)){
    throw new Error('El CU debe elegirse junto a un territorio del perímetro exterior.');
  }
  if(map.hexes.some(h=>h.special==='tc' && h.tcAnchorId===anchorTerrainId)){
    throw new Error('Esa posición exterior ya tiene un CU.');
  }

  const pos=freeOuterNeighbor(map.hexes,anchor);
  if(!pos) {
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

function hasPermanentLandPathToWonder(map, startId){
  const start=map.hexes.find(h=>h.id===startId);
  const wonder=map.hexes.find(h=>h.special==='wonder');
  if(
    !start ||
    !wonder ||
    start.terrain==='water' ||
    ['gold','stone'].includes(start.source)
  ) return false;

  const queue=[start.id];
  const seen=new Set(queue);

  while(queue.length){
    const id=queue.shift();
    if(id===wonder.id) return true;
    const current=map.hexes.find(h=>h.id===id);

    for(const candidate of map.hexes){
      if(
        candidate.terrain==='water' ||
        ['gold','stone'].includes(candidate.source) ||
        seen.has(candidate.id) ||
        hexDistance(current,candidate)!==1
      ) continue;

      seen.add(candidate.id);
      queue.push(candidate.id);
    }
  }

  return false;
}

function hasLandPathToWonder(map, startId){
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
        candidate.terrain==='water' ||
        seen.has(candidate.id) ||
        hexDistance(current,candidate)!==1
      ) continue;
      seen.add(candidate.id);
      queue.push(candidate.id);
    }
  }
  return false;
}

function startResourceValue(hex, distance){
  if(!hex) return 0;

  const base = {
    forest: 5,
    animals: 5,
    berries: 4,
    gold: 2.5,
    stone: 2
  }[hex.source] || 0;

  const terrain =
    hex.terrain === 'water' ? 0.5 :
    hex.terrain === 'mountain' ? -0.5 :
    hex.terrain === 'desert' ? -0.25 :
    0;

  const factor = distance === 0 ? 1.35 : distance === 1 ? 1 : 0.45;
  return (base + terrain) * factor;
}

function startArea(map, anchor){
  return map.hexes.filter(h => {
    if(h.special) return false;
    const d=hexDistance(anchor,h);
    return d<=2;
  });
}

export function scoreFFAStartAnchor(map, anchorId, chosenAnchorIds=[]){
  const anchor=map.hexes.find(h=>h.id===anchorId);
  if(
    !anchor ||
    !map.perimeterIds.includes(anchorId) ||
    anchor.terrain==='water' ||
    !hasLandPathToWonder(map,anchorId) ||
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

  // Un comienzo con comida + madera suele permitir decisiones reales desde
  // los primeros turnos. Oro/Piedra cercanos agregan flexibilidad posterior.
  const hasFood=nearbyResources.has('animals') || nearbyResources.has('berries');
  const hasWood=nearbyResources.has('forest');
  if(hasFood && hasWood) score+=7;
  if(nearbyResources.has('gold')) score+=1.5;
  if(nearbyResources.has('stone')) score+=1.5;
  score+=nearbyResources.size*0.75;

  // Oro/Piedra pueden agotarse y transformarse en Agua: no se prohíben como
  // elección humana, pero son una ancla inicial más riesgosa.
  if(['gold','stone'].includes(anchor.source)) score-=12;

  if(hasPermanentLandPathToWonder(map,anchorId)) score+=10;
  else score-=18;

  // Los jugadores posteriores ven los CUs ya elegidos. Evitar arrancar
  // inmediatamente encima de otro jugador suele ser una elección razonable,
  // pero no se convierte en una prohibición.
  for(const otherId of chosenAnchorIds){
    const other=map.hexes.find(h=>h.id===otherId);
    if(!other) continue;
    const d=hexDistance(anchor,other);
    if(d<=2) score-=8;
    else if(d===3) score-=3;
  }

  return score;
}

function startTieBreak(map, playerId, anchorId){
  return hashSeed(`${map.seed}:start:${playerId}:${anchorId}`) / 0xffffffff;
}

export function chooseFFAStartAnchor(map, playerId, chosenAnchorIds=[]){
  const candidates=map.perimeterIds
    .filter(id => !chosenAnchorIds.includes(id))
    .map(id => ({
      id,
      score:scoreFFAStartAnchor(map,id,chosenAnchorIds),
      tie:startTieBreak(map,playerId,id)
    }))
    .filter(x => Number.isFinite(x.score))
    .sort((a,b) => b.score-a.score || b.tie-a.tie);

  if(!candidates.length){
    throw new Error('No hay una posición exterior válida para el Centro Urbano.');
  }

  return candidates[0];
}

export function autoPlaceFFAPlayerCUs(map, players){
  const normalized=(players || []).map((player,i) =>
    typeof player === 'string'
      ? { id:player, order:i }
      : { id:player.id || `P${i+1}`, ...player, order:i }
  );

  if(normalized.length<2 || normalized.length>4){
    throw new Error('FFA admite 2 a 4 jugadores.');
  }

  const chosen=[];
  const placements=[];

  for(const player of normalized){
    const choice=chooseFFAStartAnchor(map,player.id,chosen);
    chosen.push(choice.id);
    const cu=placeFFAPlayerCU(map,player.id,choice.id);
    cu.startScore=choice.score;
    placements.push(cu);
  }

  return placements;
}
