import { AoEGame, RuleError } from '../engine/game.js';

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

function expectRuleError(fn, code, message) {
  try {
    fn();
  } catch (err) {
    ok(err instanceof RuleError, message + ' (no fue RuleError)');
    if (code) ok(err.code === code, message + ` (código ${err.code})`);
    return;
  }
  throw new Error(message + ' (no lanzó error)');
}

function game(civ1, civ2 = 'francos') {
  return AoEGame.create({
    players: [
      { id: 'P1', name: civ1, civ: civ1 },
      { id: 'P2', name: civ2, civ: civ2 }
    ],
    radius: 2
  });
}

function emptyLand(game) {
  return game.state.hexes.find(h => h.terrain !== 'water' && h.special === null);
}

// Vikingos: Galera en Dark, Arquero recién en Castles.
{
  const g = game('vikingos');
  const p = g.playerMap.get('P1');
  const hex = emptyLand(g);
  const port = g.addBuilding('P1', 'port', hex.id);
  const barracks = g.addBuilding('P1', 'barracks', hex.id);
  g.addResourceTokens(hex.id, { wood: 10, gold: 10, food: 10 });
  g.state.phase = 'military';

  const [galley] = g.trainUnits('P1', [{ type: 'galley', buildingId: port.id }]);
  ok(galley.type === 'galley', 'Vikingos debe poder entrenar Galera en Alta Edad Media.');

  g.state.actionUsed = false;
  expectRuleError(
    () => g.trainUnits('P1', [{ type: 'archer', buildingId: barracks.id }]),
    null,
    'Vikingos no debe poder entrenar Arquero antes de Castillos.'
  );

  p.age = 'castles';
  g.state.actionUsed = false;
  const [archer] = g.trainUnits('P1', [{ type: 'archer', buildingId: barracks.id }]);
  ok(archer.type === 'archer', 'Vikingos debe desbloquear Arquero en Castillos.');
}

// Vikingos: no Torre.
{
  const g = game('vikingos');
  const p = g.playerMap.get('P1');
  const v = g.state.units.find(u => u.ownerId === 'P1' && u.type === 'villager');
  g.addResourceTokens(p.tcHexId, { stone: 10, wood: 10 });
  g.state.phase = 'military';

  expectRuleError(
    () => g.build('P1', 'tower', p.tcHexId, v.id),
    'BUILDING_UNAVAILABLE',
    'Vikingos no debe poder construir Torre.'
  );
}

// Persas: Elefante en Castillos; no Caballero.
{
  const g = game('persas');
  const p = g.playerMap.get('P1');
  p.age = 'castles';
  const hex = emptyLand(g);
  const barracks = g.addBuilding('P1', 'barracks', hex.id);
  g.addResourceTokens(hex.id, { food: 12, gold: 12 });
  g.state.phase = 'military';

  const [elephant] = g.trainUnits('P1', [{ type: 'elephant', buildingId: barracks.id }]);
  ok(elephant.type === 'elephant', 'Persas debe poder entrenar Elefante.');

  g.state.actionUsed = false;
  expectRuleError(
    () => g.trainUnits('P1', [{ type: 'knight', buildingId: barracks.id }]),
    'UNIT_UNAVAILABLE',
    'Persas no debe poder entrenar Caballero.'
  );
}

// Francos: Caballero en Castillos.
{
  const g = game('francos');
  const p = g.playerMap.get('P1');
  p.age = 'castles';
  const hex = emptyLand(g);
  const barracks = g.addBuilding('P1', 'barracks', hex.id);
  g.addResourceTokens(hex.id, { food: 10, gold: 10 });
  g.state.phase = 'military';

  const [knight] = g.trainUnits('P1', [{ type: 'knight', buildingId: barracks.id }]);
  ok(knight.type === 'knight', 'Francos debe poder entrenar Caballero.');
}

// Britones: Longbow desde Castillo en Castillos.
{
  const g = game('britanicos');
  const p = g.playerMap.get('P1');
  p.age = 'castles';
  const hex = emptyLand(g);
  const castle = g.addBuilding('P1', 'castle', hex.id);
  g.addResourceTokens(hex.id, { food: 10, wood: 10, gold: 10 });
  g.state.phase = 'military';

  const [longbow] = g.trainUnits('P1', [{ type: 'longbow', buildingId: castle.id }]);
  ok(longbow.type === 'longbow', 'Britones debe poder entrenar Longbow desde Castillo.');
}

// Carretilla: modifica la capacidad real del Aldeano.
{
  const g = game('britanicos');
  const p = g.playerMap.get('P1');
  g.addResourceTokens(p.tcHexId, { wood: 1, gold: 1 });
  g.state.phase = 'technology';

  g.research('P1', 'wheelbarrow');
  ok(g.effectiveUnitSpec('P1', 'villager').carry === 3, 'Carretilla debe llevar capacidad de Aldeano de 2 a 3.');
}

// Hombre de Armas: modifica Fuerza sin tocar la definición global.
{
  const g = game('francos');
  const p = g.playerMap.get('P1');
  const hex = emptyLand(g);
  g.addBuilding('P1', 'barracks', hex.id);

  // El coste se paga desde cualquier territorio controlado para tecnologías.
  const villager = g.state.units.find(u => u.ownerId === 'P1' && u.type === 'villager');
  villager.hexId = hex.id;
  g.addResourceTokens(hex.id, { food: 2, gold: 1 });
  g.state.phase = 'technology';

  g.research('P1', 'man_at_arms');
  ok(g.effectiveUnitSpec('P1', 'militia').force === 3, 'Hombre de Armas debe subir Milicia a Fuerza 3.');
  ok(g.effectiveUnitSpec('P2', 'militia').force === 2, 'La mejora no debe afectar al rival.');
}

// Qanats: habilita Granjas persas en Desierto.
{
  const g = game('persas');
  const p = g.playerMap.get('P1');
  const v = g.state.units.find(u => u.ownerId === 'P1' && u.type === 'villager');
  const desert = g.state.hexes.find(h => h.terrain === 'desert' && h.special === null) || emptyLand(g);
  desert.terrain = 'desert';
  v.hexId = desert.id;
  g.addResourceTokens(desert.id, { wood: 2 });
  p.technologies.push('qanats');
  g.state.phase = 'economy';

  const farm = g.build('P1', 'farm', desert.id, v.id);
  ok(farm.type === 'farm', 'Qanats debe permitir Granja en Desierto.');
}

console.log('Civilization integration tests: OK');
