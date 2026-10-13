import { AoEGame, RuleError } from '../engine/game.js';

function ok(v,m){ if(!v) throw new Error(m); }
function game(civ1='vikingos',civ2='persas'){
  return AoEGame.create({
    players:[{id:'P1',civ:civ1},{id:'P2',civ:civ2}],
    radius:2
  });
}
function adjacentLand(g){
  for(const a of g.state.hexes){
    if(a.terrain==='water'||a.special) continue;
    for(const b of g.state.hexes){
      if(b.terrain==='water'||b.special) continue;
      if(Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs((-a.q-a.r)-(-b.q-b.r)))===1) return [a,b];
    }
  }
}

// Viking farm capture.
{
  const g=game('vikingos','francos');
  g.state.units=[];
  const [a,b]=adjacentLand(g);
  const attacker=g.addUnit('P1','militia',a.id);
  const farm=g.addBuilding('P2','farm',b.id);
  g.playerMap.get('P1').technologies.push('viking_settlement');
  g.state.phase='military';

  g.moveUnits('P1',[attacker.id],b.id);
  ok(g.state.buildings.find(x=>x.id===farm.id)?.ownerId==='P1','Asentamiento Vikingo debe capturar Granja indefensa.');
}

// Palisade: 1 no cruza; 2 la rompen sin moverse.
{
  const g=game('francos','persas');
  g.state.units=[];
  const [a,b]=adjacentLand(g);
  const u1=g.addUnit('P1','militia',a.id);
  const u2=g.addUnit('P1','militia',a.id);
  a.palisades=[b.id]; b.palisades=[a.id];
  g.state.phase='military';

  let failed=false;
  try{ g.moveUnits('P1',[u1.id],b.id); }catch(e){ failed=e instanceof RuleError; }
  ok(failed,'Una unidad no debe romper Empalizada.');

  g.state.actionUsed=false;
  const r=g.moveUnits('P1',[u1.id,u2.id],b.id);
  ok(r?.palisadeDestroyed===true,'Dos unidades deben destruir Empalizada.');
  ok(u1.hexId===a.id&&u2.hexId===a.id,'Al romper Empalizada las unidades deben quedarse en origen.');
  ok(!a.palisades.includes(b.id)&&!b.palisades.includes(a.id),'La Empalizada debe desaparecer de ambos lados.');
}

// Pastoreo: comida de Animales remota sirve para coste local.
{
  const g=game('britanicos','francos');
  const p=g.playerMap.get('P1');
  p.technologies.push('pasturing');
  const tc=g.hexMap.get(p.tcHexId);
  const animal=g.state.hexes.find(h=>h.source==='animals'&&h.id!==tc.id);
  const barracksHex=g.state.hexes.find(h=>h.terrain!=='water'&&h.id!==animal.id&&h.special===null);
  const v=g.state.units.find(u=>u.ownerId==='P1'&&u.type==='villager');
  v.hexId=barracksHex.id;
  g.addResourceTokens(barracksHex.id,{wood:1,stone:3,gold:1});
  g.addResourceTokens(animal.id,{food:1});
  // Controlar Animales con otro aldeano.
  g.addUnit('P1','villager',animal.id);
  g.state.phase='military';
  const barracks=g.build('P1','barracks',barracksHex.id,v.id);
  ok(barracks.type==='barracks','Construcción debe usar pago local normal.');
  g.state.actionUsed=false;
  g.addResourceTokens(barracksHex.id,{gold:1});
  const [mil]=g.trainUnits('P1',[{type:'militia',buildingId:barracks.id}]);
  ok(mil.type==='militia','Pastoreo debe permitir pagar Comida remota de Animales.');
}

// Persa Forraje: hasta 2 comida desde Granja al Elefante.
{
  const g=game('persas','francos');
  const p=g.playerMap.get('P1'); p.age='castles'; p.technologies.push('forage');
  const tc=g.hexMap.get(p.tcHexId);
  const farmHex=g.state.hexes.find(h=>h.terrain!=='water'&&h.id!==tc.id&&h.special===null);
  const barracksHex=g.state.hexes.find(h=>h.terrain!=='water'&&h.id!==tc.id&&h.id!==farmHex.id&&h.special===null);
  g.addBuilding('P1','farm',farmHex.id);
  g.addUnit('P1','villager',farmHex.id);
  g.addResourceTokens(farmHex.id,{food:2});
  const b=g.addBuilding('P1','barracks',barracksHex.id);
  g.addUnit('P1','villager',barracksHex.id);
  g.addResourceTokens(barracksHex.id,{food:2,gold:4});
  g.state.phase='military';
  const [e]=g.trainUnits('P1',[{type:'elephant',buildingId:b.id}]);
  ok(e.type==='elephant','Forraje debe completar el coste del Elefante con comida de Granja.');
}

// Conscripción: primera Milicia franca cuesta 0 Comida, segunda vuelve a costar 1.
{
  const g=game('francos','persas');
  const p=g.playerMap.get('P1'); p.age='feudal'; p.technologies.push('conscription');
  const h=g.state.hexes.find(x=>x.terrain!=='water'&&x.special===null);
  const b=g.addBuilding('P1','barracks',h.id);
  g.addUnit('P1','villager',h.id);
  g.addResourceTokens(h.id,{food:1,gold:2});
  g.state.phase='military';
  const made=g.trainUnits('P1',[
    {type:'militia',buildingId:b.id},
    {type:'militia',buildingId:b.id}
  ]);
  ok(made.length===2,'Conscripción debe permitir pagar 2 Milicias con 1 Comida + 2 Oro.');
  ok(g.resourcesAt(h.id).food===0&&g.resourcesAt(h.id).gold===0,'Debe gastar exactamente los recursos esperados.');
}

// Viking Dismantle.
{
  const g=game('vikingos','francos');
  const p=g.playerMap.get('P1'); p.age='feudal'; p.technologies.push('dismantle');
  const h=g.hexMap.get(p.tcHexId);
  const mill=g.addBuilding('P1','mill',h.id);
  g.state.phase='economy';
  g.dismantleBuilding('P1',mill.id,{wood:2});
  ok(!g.state.buildings.some(b=>b.id===mill.id),'Desmantelar debe retirar edificio.');
  ok(g.resourcesAt(h.id).wood===2,'Desmantelar debe devolver 2 recursos válidos.');
}

// Carreta Mercante.
{
  const g=game('vikingos','francos');
  const p=g.playerMap.get('P1'); p.age='castles'; p.technologies.push('trade_wagon');
  const a=g.hexMap.get(p.tcHexId);
  const b=g.state.hexes.find(h=>h.terrain!=='water'&&h.special===null);
  g.addBuilding('P1','camp',b.id);
  g.addResourceTokens(a.id,{wood:3,gold:2});
  g.state.phase='economy';
  const moved=g.useTradeWagon('P1',a.id,b.id,{wood:3,gold:2});
  ok(moved===5,'Carreta debe mover los recursos solicitados.');
  ok(g.resourcesAt(b.id).wood===3&&g.resourcesAt(b.id).gold===2,'Recursos deben llegar al destino.');
}

console.log('Economic special rules tests: OK');
