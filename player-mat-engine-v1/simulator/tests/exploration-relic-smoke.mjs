import { AoEGame } from '../engine/game.js';

function ok(v,m){if(!v)throw new Error(m);}
function make(){
  return AoEGame.create({
    players:[
      {id:'P1',civ:'britanicos'},
      {id:'P2',civ:'francos'}
    ],
    radius:2,
    explorationSeed:'explore-test'
  });
}

// Mazo: 16 cartas.
{
  const g=make();
  ok(g.state.exploration.deck.length===16,'El mazo de Exploración debe tener 16 cartas.');
}

// Montaña sólo se explora una vez y una carta no inmediata va a la mano.
{
  const g=make();
  const mountain=g.state.hexes.find(h=>h.terrain==='mountain');
  // Forzar una carta conservable arriba.
  g.state.exploration.deck=['stash',...g.state.exploration.deck.filter(x=>x!=='stash')];
  const c=g.drawExplorationCard('P1',mountain.id);
  ok(c.id==='stash','Debe robar Alijo.');
  ok(mountain.explored===true,'La Montaña debe quedar marcada como explorada.');
  ok(g.explorationHand('P1').includes('stash'),'Alijo debe quedar en mano.');
  let failed=false;
  try{g.drawExplorationCard('P1',mountain.id);}catch{failed=true;}
  ok(failed,'La misma Montaña no puede explorarse dos veces.');
}

// Tesoro: +2 Oro sobre la Montaña y descarte.
{
  const g=make();
  const mountain=g.state.hexes.find(h=>h.terrain==='mountain');
  g.state.exploration.deck=['treasure'];
  g.drawExplorationCard('P1',mountain.id);
  ok(g.resourcesAt(mountain.id).gold===2,'Tesoro debe colocar 2 Oro.');
  ok(g.state.exploration.discard.includes('treasure'),'Tesoro debe descartarse.');
}

// Mercenarios: Milicia en la Montaña.
{
  const g=make();
  const mountain=g.state.hexes.find(h=>h.terrain==='mountain');
  g.state.exploration.deck=['mercenaries'];
  g.drawExplorationCard('P1',mountain.id);
  ok(g.state.units.some(u=>u.ownerId==='P1'&&u.type==='militia'&&u.hexId===mountain.id),'Mercenarios debe crear Milicia.');
}

// Reliquia: queda en Montaña y vuelve al mazo.
{
  const g=make();
  const mountain=g.state.hexes.find(h=>h.terrain==='mountain');
  g.state.exploration.deck=['relic'];
  g.drawExplorationCard('P1',mountain.id);
  ok(mountain.relics===1,'Reliquia debe quedar en la Montaña.');
  ok(g.state.exploration.deck.includes('relic'),'La carta Reliquia debe volver al mazo.');
}

// Transporte y depósito de Reliquia.
{
  const g=make();
  const p=g.playerMap.get('P1');
  p.age='castles';
  const h=g.hexMap.get(p.tcHexId);
  h.relics=1;
  const missionary=g.addUnit('P1','missionary',h.id);
  const monastery=g.addBuilding('P1','monastery',h.id);

  g.pickupRelic('P1',missionary.id);
  ok(missionary.relics===1&&h.relics===0,'Misionero debe recoger Reliquia.');
  const n=g.depositRelics('P1',missionary.id,monastery.id);
  ok(n===1&&monastery.relics===1&&missionary.relics===0,'Debe depositar la Reliquia.');

  const before=g.resourcesAt(h.id).gold;
  const income=g.applyStartTurnIncome('P1');
  ok(income===2,'Una Reliquia debe dar 2 Oro.');
  ok(g.resourcesAt(h.id).gold===before+2,'El Oro debe colocarse en el hexágono del Monasterio.');
}

// Maravilla: INSTRUIR gratis.
{
  const g=make();
  const p=g.playerMap.get('P1');
  const wonder=g.state.hexes.find(h=>h.special==='wonder');
  const vill=g.state.units.find(u=>u.ownerId==='P1');
  vill.hexId=wonder.id;
  g.state.phase='military';
  const before=g.resourcesAt(p.tcHexId).gold;
  g.instruct('P1');
  ok(p.militaryPower===1,'INSTRUIR debe aumentar Poder.');
  ok(g.resourcesAt(p.tcHexId).gold===before,'Controlar Maravilla debe evitar el coste de Oro.');
}

console.log('Exploration relic wonder tests: OK');
