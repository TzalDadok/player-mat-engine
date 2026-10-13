import { AoEGame } from '../engine/game.js';

function ok(v,m){if(!v)throw new Error(m);}
function make(civ='britanicos'){
  return AoEGame.create({
    players:[{id:'P1',civ},{id:'P2',civ:'francos'}],
    radius:2
  });
}

// Alijo.
{
  const g=make();
  const p=g.playerMap.get('P1');
  g.state.exploration.hands.P1=['stash'];
  g.playExplorationCard('P1','stash',{hexId:p.tcHexId,resources:{wood:1,gold:1}});
  ok(g.resourcesAt(p.tcHexId).wood===1&&g.resourcesAt(p.tcHexId).gold===1,'Alijo debe agregar exactamente 2 recursos.');
}

// Manos Extra modifica PRODUCIR.
{
  const g=make();
  const v=g.state.units.find(u=>u.ownerId==='P1'&&u.type==='villager');
  const h=g.state.hexes.find(x=>x.source==='forest'&&x.special===null);
  v.hexId=h.id;
  g.state.exploration.hands.P1=['extra_hands'];
  g.playExplorationCard('P1','extra_hands',{unitId:v.id});
  const r=g.produce('P1',[h.id]);
  ok(r[0].amount===2,'Manos Extra debe sumar +1 al Aldeano.');
}

// Ingenio descuenta Madera al construir.
{
  const g=make();
  const p=g.playerMap.get('P1');
  const v=g.state.units.find(u=>u.ownerId==='P1');
  g.addResourceTokens(p.tcHexId,{wood:2});
  g.state.exploration.hands.P1=['ingenuity'];
  g.playExplorationCard('P1','ingenuity',{});
  const mill=g.build('P1','mill',p.tcHexId,v.id);
  ok(mill.type==='mill','Ingenio debe permitir Molino pagando 2 Madera.');
}

// Conocimiento Ancestral descuenta recurso elegido.
{
  const g=make();
  const p=g.playerMap.get('P1');
  g.addResourceTokens(p.tcHexId,{wood:1});
  // Telar cuesta food1 wood1: descontar food.
  g.state.exploration.hands.P1=['ancestral_knowledge'];
  g.playExplorationCard('P1','ancestral_knowledge',{resourceType:'food'});
  g.state.phase='technology';
  g.research('P1','loom');
  ok(p.technologies.includes('loom'),'Conocimiento Ancestral debe aplicar descuento a tecnología.');
}

// Refuerzos y +2 Poder afectan combate.
{
  const g=make();
  g.state.units=[]; g.state.phase='military';
  const h1=g.state.hexes.find(h=>h.terrain!=='water'&&h.special===null);
  const h2=g.state.hexes.find(h=>h.id!==h1.id&&h.terrain!=='water'&&h.special===null&&Math.max(
    Math.abs(h.q-h1.q),Math.abs(h.r-h1.r),Math.abs((-h.q-h.r)-(-h1.q-h1.r))
  )===1);
  const a=g.addUnit('P1','militia',h1.id);
  g.addUnit('P2','militia',h2.id);
  g.state.exploration.hands.P1=['reinforcements','combat_power_2'];
  g.playExplorationCard('P1','reinforcements',{unitId:a.id});
  g.playExplorationCard('P1','combat_power_2',{});
  const r=g.attack('P1',{unitIds:[a.id],targetHexId:h2.id});
  ok(r.attackerBreakdown.contextual===1,'Refuerzos debe sumar +1 Fuerza.');
  ok(r.attackerCardPower===2,'Carta +2 Poder debe sumar 2 a la Fuerza final.');
  ok(r.winnerId==='P1','2 base +1 +2 debe ganar contra Milicia 2.');
}

console.log('Exploration card effects tests: OK');
