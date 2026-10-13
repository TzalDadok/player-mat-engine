import { AoEGame } from '../engine/game.js';
import { hexDistance } from '../engine/hex.js';
import { BaselineBot } from '../bots/baseline.js';
import { getBotProfile } from '../bots/profiles.js';

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
    players: details,
    recentLog: game.state.log.slice(-40),
    aliveUnits: game.state.units
      .filter(u => alive.some(p => p.id === u.ownerId))
      .map(u => ({
        id:u.id,
        ownerId:u.ownerId,
        type:u.type,
        hexId:u.hexId,
        embarkedIn:u.embarkedIn,
        garrisonedIn:u.garrisonedIn
      })),
    starts: alive.map(p => {
      const tc=game.hexMap.get(p.tcHexId);
      const anchor=tc?.tcAnchorId ? game.hexMap.get(tc.tcAnchorId) : null;
      return {
        playerId:p.id,
        tcHexId:p.tcHexId,
        anchorId:anchor?.id || null,
        anchorTerrain:anchor?.terrain || null,
        anchorSource:anchor?.source || null
      };
    })
  };
}

function firstLogRound(game, predicate) {
  const entry = game.state.log.find(predicate);
  return entry ? entry.round : null;
}

function playerMilestones(game, playerId) {
  const firstBarracks = firstLogRound(
    game,
    x =>
      x.playerId === playerId &&
      x.type === 'build' &&
      x.data?.buildingType === 'barracks'
  );

  const firstMilitary = firstLogRound(
    game,
    x =>
      x.playerId === playerId &&
      x.type === 'train' &&
      (x.data?.units || []).some(u => {
        try {
          return game.effectiveUnitSpec(playerId, u.type).category === 'military';
        } catch {
          return false;
        }
      })
  );

  const firstTechnology = firstLogRound(
    game,
    x => x.playerId === playerId && x.type === 'research'
  );

  const firstCombat = firstLogRound(
    game,
    x =>
      x.type === 'combat' &&
      (x.playerId === playerId || x.data?.defenderId === playerId)
  );

  const firstAttack = firstLogRound(
    game,
    x => x.type === 'combat' && x.playerId === playerId
  );

  const firstElimination = firstLogRound(
    game,
    x =>
      x.type === 'player-eliminated' &&
      x.data?.killerId === playerId
  );

  const ages = {};
  for (const age of ['feudal','castles','imperial']) {
    ages[age] = firstLogRound(
      game,
      x =>
        x.playerId === playerId &&
        x.type === 'advance-age' &&
        x.data?.age === age
    );
  }

  return {
    firstBarracks,
    firstMilitary,
    firstTechnology,
    firstCombat,
    firstAttack,
    firstElimination,
    feudal: ages.feudal,
    castles: ages.castles,
    imperial: ages.imperial
  };
}

const ECON_RESOURCES = ['food','wood','stone','gold'];

function emptyResourceTotals(){
  return Object.fromEntries(ECON_RESOURCES.map(r=>[r,0]));
}

function addCost(target,cost={}){
  for(const r of ECON_RESOURCES){
    target[r]+=Math.max(0,Number(cost?.[r]||0));
  }
}

function economyMetrics(game,playerId){
  const produced=emptyResourceTotals();
  const spent=emptyResourceTotals();
  const raidedIn=emptyResourceTotals();
  const raidedOut=emptyResourceTotals();

  for(const entry of game.state.log){
    if(entry.type==='produce'){
      for(const result of entry.data?.results||[]){
        const resource=result.resourceType;
        if(entry.playerId===playerId && resource in produced){
          produced[resource]+=Number(result.amount||0);
          if(result.raidedBy){
            raidedOut[resource]+=Number(result.raidedAmount||0);
          }
        }
        if(result.raidedBy===playerId && resource in raidedIn){
          raidedIn[resource]+=Number(result.raidedAmount||0);
        }
      }
    }

    if(entry.playerId!==playerId) continue;

    if(entry.type==='train'){
      for(const unit of entry.data?.units||[]){
        addCost(spent,unit.paidCost);
      }
    } else if(
      ['build','research','advance-age','instruct'].includes(entry.type)
    ){
      addCost(spent,entry.data?.paidCost);
    }
  }

  const totalProduced=Object.values(produced).reduce((a,b)=>a+b,0);
  const totalSpent=Object.values(spent).reduce((a,b)=>a+b,0);

  return {
    produced,
    spent,
    raidedIn,
    raidedOut,
    totalProduced,
    totalSpent
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

    const start = game.state.mapMeta?.startPositions?.find(x=>x.playerId===p.id) || null;
    const anchor = start?.anchorTerrainId ? game.hexMap.get(start.anchorTerrainId) : null;

    const playerCombats = game.state.log.filter(x =>
      x.type === 'combat' &&
      (x.playerId === p.id || x.data?.defenderId === p.id)
    );
    const attacks = playerCombats.filter(x=>x.playerId===p.id);
    const defenses = playerCombats.filter(x=>x.data?.defenderId===p.id);

    const eliminatedEntry = game.state.log.find(x =>
      x.type === 'player-eliminated' &&
      x.data?.playerId === p.id
    );

    return {
      id:p.id,
      seat:game.state.players.indexOf(p)+1,
      civ:p.civ,
      eliminated:p.eliminated,
      eliminatedRound:eliminatedEntry?.round ?? null,
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
      economy:economyMetrics(game,p.id),
      start:{
        cuHexId:start?.cuHexId || p.tcHexId,
        anchorTerrainId:start?.anchorTerrainId || null,
        anchorTerrain:anchor?.terrain || null,
        anchorSource:anchor?.source || null,
        score:Number.isFinite(start?.startScore) ? start.startScore : null,
        selectionIndex:Number.isFinite(start?.selectionIndex)
          ? start.selectionIndex
          : null,
        initialVillagers:game.state.mapMeta?.startAssignments?.find(x=>x.playerId===p.id)?.villagers ?? null,
        initialMilitaryPower:game.state.mapMeta?.startAssignments?.find(x=>x.playerId===p.id)?.militaryPower ?? null
      },
      combat:{
        fought:playerCombats.length,
        wins:playerCombats.filter(x=>x.data?.winnerId===p.id).length,
        attacks:attacks.length,
        attackWins:attacks.filter(x=>x.data?.winnerId===p.id).length,
        defenses:defenses.length,
        defenseWins:defenses.filter(x=>x.data?.winnerId===p.id).length
      },
      milestones:playerMilestones(game,p.id),
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
    mapPreset:game.state.mapMeta?.preset || null,
    rounds:game.state.round,
    winnerId:winner?.id || null,
    winnerCiv:winner?.civ || null,
    cuSelectionOrder:[...(game.state.mapMeta?.cuSelectionOrder || [])],
    logEntries:game.state.log.length,
    actions:actions.length,
    combats:combats.length,
    players
  };
}

export function createFFABots(game, {
  botSeed = 'baseline',
  profile = 'balanced',
  profileByPlayer = null,
  overrides = {}
} = {}) {
  return new Map(game.state.players.map(p => {
    const profileId = profileByPlayer?.[p.id] || profile;
    const config = getBotProfile(profileId);

    return [
      p.id,
      new BaselineBot({
        playerId:p.id,
        seed:`${botSeed}:${game.state.mapMeta?.seed || ''}`,
        ...config,
        ...overrides
      })
    ];
  }));
}

export function runFFAGame({
  civs = DEFAULT_CIVS,
  seed = 'sim-1',
  botSeed = 'baseline',
  maxRounds = 250,
  maxSteps = 10000,
  profile = 'balanced',
  profileByPlayer = null,
  botOverrides = {},
  cuSelectionOrder = null,
  mapPreset = 'ffa36',
  startingVillagers = 1,
  startingSetupByPriority = null,
  requireTwoAdjacentLand = startingSetupByPriority!==null || startingVillagers===3,
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

  const game = AoEGame.createFFA({
    players,
    seed,
    cuSelectionOrder,
    mapPreset,
    requireTwoAdjacentLand
  });
  // The CU-selection priority, not the fixed player seat, determines a
  // starting compensation. All players still get the default CU villager.
  if(startingSetupByPriority!==null &&
     (!Array.isArray(startingSetupByPriority)||startingSetupByPriority.length!==4)) {
    throw new Error('startingSetupByPriority debe tener cuatro entradas');
  }
  const startAssignments = [];
  for(const player of game.state.players){
    const placement=game.state.mapMeta.startPositions.find(p=>p.playerId===player.id);
    const priority=placement?.selectionIndex;
    if(!Number.isInteger(priority)||priority<1||priority>4) {
      throw new Error('Prioridad inicial de CU inexistente');
    }
    const configured=startingSetupByPriority?.[priority-1] ||
      {villagers:startingVillagers,militaryPower:0};
    const count=configured.villagers;
    const power=configured.militaryPower ?? 0;
    if(!Number.isInteger(count)||count<1||count>3||
       !Number.isInteger(power)||power<0){
      throw new Error('Configuracion inicial de aldeanos/poder no valida');
    }
    const cu=game.hexMap.get(player.tcHexId);
    if(game.state.units.filter(u=>u.ownerId===player.id&&u.type==='villager').length!==1||
       !game.state.units.some(u=>u.ownerId===player.id&&u.type==='villager'&&u.hexId===cu.id)){
      throw new Error('El motor no creo exactamente un aldeano en el CU');
    }
    const neighbors=game.state.hexes
      .filter(h=>!h.special&&h.terrain!=='water'&&hexDistance(h,cu)===1)
      .sort((a,b)=>a.id.localeCompare(b.id));
    if(neighbors.length<count-1){
      throw new Error(`CU de ${player.id} tiene solo ${neighbors.length} terrenos terrestres adyacentes para ${count-1} aldeanos`);
    }
    for(const hex of neighbors.slice(0,count-1)) {
      game.addUnit(player.id,'villager',hex.id);
    }
    player.militaryPower=power;
    const initial=game.state.units.filter(u=>u.ownerId===player.id&&u.type==='villager');
    if(initial.length!==count||new Set(initial.map(u=>u.hexId)).size!==count) {
      throw new Error('Numero o distribucion de aldeanos iniciales incorrecta');
    }
    startAssignments.push({playerId:player.id,priority,villagers:count,militaryPower:power,
      cuHexId:cu.id,adjacentHexIds:initial.filter(u=>u.hexId!==cu.id).map(u=>u.hexId)});
  }
  game.state.mapMeta.startAssignments=startAssignments;
  const bots = createFFABots(game, {
    botSeed,
    profile,
    profileByPlayer,
    overrides: botOverrides
  });

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
