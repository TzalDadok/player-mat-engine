import { AoEGame } from '../engine/game.js';

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

function game2() {
  return AoEGame.create({
    players: [
      { id: 'P1', name: 'Britones', civ: 'britanicos' },
      { id: 'P2', name: 'Vikingos', civ: 'vikingos' }
    ],
    radius: 2
  });
}

{
  const game = game2();
  const p1 = game.playerMap.get('P1');
  ok(game.state.buildings.length === 0, 'El CU no debe existir como edificio.');
  ok(game.resourcesAt(p1.tcHexId).food === 0, 'No deben inventarse recursos iniciales.');
  ok(game.controllerOf(p1.tcHexId) === 'P1', 'El Aldeano inicial debe controlar su CU.');
}

{
  const game = game2();
  const p1 = game.playerMap.get('P1');
  game.addResourceTokens(p1.tcHexId, { food: 4, wood: 2, stone: 1, gold: 1 });
  game.pass('P1');
  game.endPhase();
  game.advanceAge('P1');
  ok(p1.age === 'feudal', 'El avance a Feudal debe funcionar con recursos controlados.');
  ok(Object.values(game.resourcesAt(p1.tcHexId)).every(n => n === 0), 'El avance debe gastar los recursos.');
}

{
  const game = game2();
  const p1 = game.playerMap.get('P1');
  const worker = game.state.units.find(u => u.ownerId === 'P1' && u.type === 'villager');
  const resourceHex = game.state.hexes.find(h => h.source === 'animals' && h.special !== 'tc');
  worker.hexId = resourceHex.id;
  game.addUnit('P1', 'villager', resourceHex.id);
  game.addBuilding('P1', 'mill', resourceHex.id);
  const result = game.produce('P1', [resourceHex.id]);
  ok(result[0].amount === 3, '2 Aldeanos + Molino sobre Animales deben producir 3.');
  ok(game.resourcesAt(resourceHex.id).food === 3, 'Las fichas producidas deben quedar en el hexágono.');
}

{
  const game = game2();
  const worker = game.state.units.find(u => u.ownerId === 'P1' && u.type === 'villager');
  const resourceHex = game.state.hexes.find(h => h.source === 'forest' && h.special !== 'tc');
  worker.hexId = resourceHex.id;
  game.produce('P1', [resourceHex.id]);
  game.state.actionUsed = false;
  game.state.round += 1;
  game.produce('P1', [resourceHex.id]);
  ok(resourceHex.source === null && resourceHex.terrain === 'plain', 'Dos turnos propios consecutivos deben agotar el Bosque.');
}

{
  const game = game2();
  const p1 = game.playerMap.get('P1');
  const p2 = game.playerMap.get('P2');
  game.state.phase = 'military';
  game.state.units = game.state.units.filter(u => u.ownerId !== 'P1' && u.ownerId !== 'P2');

  const target = game.state.hexes.find(h => h.special === null && h.terrain !== 'water');
  const origin = game.state.hexes.find(h => h.id !== target.id && h.terrain !== 'water' && Math.max(
    Math.abs(h.q - target.q),
    Math.abs(h.r - target.r),
    Math.abs((-h.q-h.r)-(-target.q-target.r))
  ) === 1);

  const a1 = game.addUnit('P1', 'militia', origin.id);
  const a2 = game.addUnit('P1', 'militia', origin.id);
  game.addUnit('P2', 'militia', target.id);

  const result = game.attack('P1', { unitIds: [a1.id, a2.id], targetHexId: target.id });
  ok(result.winnerId === 'P1', '4 de Fuerza contra 2 debe ganar el atacante.');
  ok(result.casualties.length === 1, 'No pueden morir más unidades que participantes: el defensor pierde su única Milicia.');
  ok(game.state.units.filter(u => u.ownerId === 'P2' && u.hexId === target.id).length === 0, 'La defensa derrotada debe abandonar el hexágono.');
  ok(game.state.units.filter(u => u.ownerId === 'P1' && u.hexId === target.id).length === 2, 'Los atacantes vencedores deben ocupar el hexágono.');

  // Mantener referencias usadas para evitar optimizaciones/confusiones del test.
  ok(p1.tcHexId && p2.tcHexId, 'Ambos jugadores deben conservar referencia a su CU.');
}

{
  const game = game2();
  game.state.phase = 'military';
  const p2 = game.playerMap.get('P2');
  const tc = game.hexMap.get(p2.tcHexId);
  const origin = game.state.hexes.find(h => h.terrain !== 'water' && h.id !== tc.id && Math.max(
    Math.abs(h.q - tc.q),
    Math.abs(h.r - tc.r),
    Math.abs((-h.q-h.r)-(-tc.q-tc.r))
  ) === 1);

  // Retirar defensa militar del CU; el Aldeano económico puede seguir allí.
  const attacker = game.addUnit('P1', 'militia', origin.id);
  const result = game.attack('P1', { unitIds: [attacker.id], targetHexId: tc.id });
  ok(result.unopposed === true, 'Un CU sin defensa militar debe conquistarse sin batalla.');
  ok(p2.eliminated === true, 'Conquistar el CU debe eliminar a la civilización.');
  ok(game.state.units.every(u => u.ownerId !== 'P2'), 'Al eliminarse una civilización se retiran sus unidades.');
}

console.log('Hito 1 smoke tests: OK');
