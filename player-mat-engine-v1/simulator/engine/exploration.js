export const EXPLORATION_CARDS = [
  {id:'stash', category:'economy', name:'Alijo', immediate:false},
  {id:'treasure', category:'economy', name:'Tesoro', immediate:true},
  {id:'extra_hands', category:'economy', name:'Manos Extra', immediate:false},
  {id:'local_guides', category:'economy', name:'Guías Locales', immediate:false},
  {id:'caravan', category:'economy', name:'Caravana', immediate:false},
  {id:'abundant_hunt', category:'economy', name:'Caza Abundante', immediate:false},
  {id:'good_harvest', category:'economy', name:'Buena Cosecha', immediate:false},

  {id:'ingenuity', category:'technology', name:'Ingenio', immediate:false},
  {id:'cartography', category:'technology', name:'Cartografía', immediate:false},
  {id:'ancestral_knowledge', category:'technology', name:'Conocimiento Ancestral', immediate:false},

  {id:'reinforcements', category:'military', name:'Refuerzos', immediate:false},
  {id:'mercenaries', category:'military', name:'Mercenarios', immediate:true},
  {id:'forced_march', category:'military', name:'Marcha Forzada', immediate:false},
  {id:'combat_power_1', category:'military', name:'+1 Poder de Pelea', immediate:false},
  {id:'combat_power_2', category:'military', name:'+2 Poder de Pelea', immediate:false},
  {id:'relic', category:'military', name:'Reliquia', immediate:true, reshuffle:true}
];

function seedHash(seed){
  let h=2166136261;
  for(const ch of String(seed ?? 'aevum-exploration')){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}
function rng(seed){
  let a=seedHash(seed);
  return ()=>{
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
export function shuffleCards(cards, seed){
  const r=rng(seed);
  const out=[...cards];
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(r()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
export function createExplorationState(seed='aevum-exploration'){
  return {
    seed:String(seed),
    shuffleCount:0,
    deck:shuffleCards(EXPLORATION_CARDS.map(c=>c.id),seed),
    discard:[],
    hands:{}
  };
}
export function cardById(id){
  return EXPLORATION_CARDS.find(c=>c.id===id)||null;
}
