import { AoEGame } from '../engine/game.js';
import { BaselineBot } from '../bots/baseline.js';

export const DEFAULT_CIVS = ['britanicos','francos','vikingos','persas'];

function stallDiagnostics(game, bots) {
  const alive = game.state.players.filter(p => !p.eliminated);
  const details = alive.map(p => {
    const units = game.state.units.filter(u => u.ownerId === p.id);
    const military = units.filter(u => game.effectiveUnitSpec(p.id,u.type).category === 'military');
    const villagers = units.filter(u => u.type === 'villager');
    const buildings = game.state.buildings.filter(b => b.ownerId === p.id);
    const controlled = game.controlledHexIds(p.id);
    const resources = { food:0,wood:0,stone:0,gold:0 };
    for (const id of controlled) {
      const row = game.resourcesAt(id);
      for (const r of Object.keys(resources)) resources[r] += row[r] || 0;
    }

    let category = 'active';
    if (!villagers.length && !military.length) category = 'no-mobile-units';
    else if (!buildings.some(b => b.type === 'barracks') && military.length === 0) category = 'no-barracks';
    else if (military.length === 0) category = 'no-army';
    else if ((bots.get(p.id)?.memory?.passes || 0) > game.state.round * 2) category = 'high-pass-rate';

    return {
      playerId:p.id,
      civ:p.civ,
      category,
      villagers:villagers.length,
      military:military.length,
      buildings:buildings.length,
      controlled:controlled.length,
      resources,
      passes:bots.get(p.id)?.memory?.passes || 0
    };
  });

  const counts = {};
  for (const d of details) counts[d.category] = (counts[d.category] || 0) + 1;

  return {
    alivePlayers: alive.length,
    categories: counts,
    players: details
  };
}

function snapshotMetrics(game, bots, status) {
  const winner = game.state.winnerId ? game.playerMap.get(game.state.winnerId) : null;

  const players = game.state.players.map(p => {
    const controlled = game.controlledHexIds(p.id);
    const resources = { food:0, wood:0, stone:0, gold:0 };
    for (const id of controlled) {
      const row = game.resourcesAt(id);
      for (const r of Object.keys(resources)) resources[r] += row[r] || 0;
    }

    return {
      id:p.id,
      civ:p.civ,
      eliminated:p.eliminated,
      age:p.age,
      militaryPower:p.militaryPower,
      technologies:p.technologies.length,
      villagersTrained:p.stats.villagersTrained,
      militaryTrained:p.stats.militaryTrained,
      eliminations:p.stats.eliminations,
      unitsAlive:game.state.units.filter(u=>u.ownerId===p.id).length,
      buildingsAlive:game.state.buildings.filter(b=>b.ownerId===p.id).length,
      controlledTerritories:controlled.filter(id=>!game.hexMap.get(id)?.special).length,
      resources,
      bot:bots.get(p.id)?.memory || null
    };
  });

  const combats = game.state.log.filter(x => x.type === 'combat');
  const actions = game.state.log.filter(x =>
    !['phase-start','turn-start','game-start','game-end','ffa-map-created'].includes(x.type)
  );

  return {
    status,
    mode:game.state.mode,
    seed:game.state.mapMeta?.seed || null,
    rounds:game.state.round,
    winnerId:winner?.id || null,
    winnerCiv:winner?.civ || null,
    logEntries:game.state.log.length,
    actions:actions.length,
    combats:combats.length,
    players
  };
}

export function createFFABots(game, {
  botSeed = 'baseline',
  aggression = 0.2,
  maxVillagers = 4
} = {}) {
  return new Map(game.state.players.map(p => [
    p.id,
    new BaselineBot({
      playerId:p.id,
      seed:`${botSeed}:${game.state.mapMeta?.seed || ''}`,
      aggression,
      maxVillagers
    })
  ]));
}

export function runFFAGame({
  civs = DEFAULT_CIVS,
  seed = 'sim-1',
  botSeed = 'baseline',
  maxRounds = 250,
  maxSteps = 10000,
  aggression = 0.7,
  maxVillagers = 4,
  captureLog = false
} = {}) {
  if (!Array.isArray(civs) || civs.length < 2 || civs.length > 4) {
    throw new Error('runFFAGame requiere entre 2 y 4 civilizaciones.');
  }

  const players = civs.map((civ, i) => ({
    id:`P${i+1}`,
    name:`${civ}-${i+1}`,
    civ
  }));

  const game = AoEGame.createFFA({ players, seed });
  const bots = createFFABots(game, { botSeed, aggression, maxVillagers });

  let steps = 0;
  let status = 'running';

  while (!game.state.winnerId && game.state.round <= maxRounds && steps < maxSteps) {
    const activeId = game.activePlayer.id;
    const bot = bots.get(activeId);

    if (!bot) throw new Error(`No existe bot para ${activeId}.`);

    bot.takePhase(game);

    if (game.state.winnerId) break;

    game.endPhase();
    steps++;
  }

  if (game.state.winnerId) status = 'completed';
  else if (game.state.round > maxRounds) status = 'max-rounds';
  else if (steps >= maxSteps) status = 'max-steps';

  const metrics = snapshotMetrics(game, bots, status);
  metrics.steps = steps;
  if (status !== 'completed') metrics.stall = stallDiagnostics(game, bots);

  if (captureLog) metrics.log = structuredClone(game.state.log);

  return metrics;
}
