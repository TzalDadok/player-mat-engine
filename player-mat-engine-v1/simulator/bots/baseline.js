import {
  AGE_COSTS,
  AGES,
  RESOURCE_TYPES,
  SOURCE_TO_RESOURCE
} from '../engine/constants.js';
import {
  hexDistance,
  physicalNeighbors
} from '../engine/hex.js';
import { createRng, pickRandom, shuffle } from './rng.js';

function stableTargetTie(seed, attacker, defender){
  let h=2166136261;
  for(const ch of String(seed)+':'+attacker+':'+defender){
    h=Math.imul(h^ch.charCodeAt(0),16777619);
  }
  return h>>>0;
}

function strategicLandPath(game, fromId, toId) {
  if (fromId === toId) return [fromId];

  const byId = game.hexMap;
  const start = byId.get(fromId);
  const goal = byId.get(toId);
  if (!start || !goal || goal.terrain === 'water') return null;

  const queue = [fromId];
  const prev = new Map([[fromId, null]]);

  while (queue.length) {
    const currentId = queue.shift();
    const current = byId.get(currentId);

    for (const candidate of [...game.state.hexes].sort((a,b)=>a.q-b.q || a.r-b.r)) {
      if (
        candidate.terrain === 'water' ||
        prev.has(candidate.id) ||
        hexDistance(current, candidate) !== 1 ||
        game.edgeBlocked(currentId, candidate.id)
      ) continue;

      prev.set(candidate.id, currentId);

      if (candidate.id === toId) {
        const path = [];
        let cursor = toId;
        while (cursor) {
          path.push(cursor);
          cursor = prev.get(cursor);
        }
        return path.reverse();
      }

      queue.push(candidate.id);
    }
  }

  return null;
}

const MILITARY_PRIORITY = [
  'knight','elephant','rider','longbow','militia','spearman','archer','skirmisher','galley'
];

const HUB_TARGET_BEFORE_BARRACKS = { wood: 2, stone: 3, gold: 1, food: 1 };
const HUB_TARGET_AFTER_BARRACKS = { food: 6, gold: 6, wood: 3, stone: 2 };

function sumResources(game, ids) {
  const out = Object.fromEntries(RESOURCE_TYPES.map(r => [r, 0]));
  for (const id of ids) {
    const row = game.resourcesAt(id);
    for (const r of RESOURCE_TYPES) out[r] += row[r] || 0;
  }
  return out;
}

function canPay(have, cost = {}) {
  return RESOURCE_TYPES.every(r => (have[r] || 0) >= (cost[r] || 0));
}

function costWeight(cost = {}) {
  return RESOURCE_TYPES.reduce((n, r) => n + Number(cost[r] || 0), 0);
}

function forceOf(game, playerId, units) {
  return units.reduce((n, u) => n + game.effectiveUnitSpec(playerId, u.type).force, 0);
}

export class BaselineBot {
  constructor({
    playerId,
    seed = 'bot',
    aggression = 0.2,
    maxVillagers = 4,
    desiredArmy = 5,
    maxArmy = 8,
    villagerCadence = 3,
    ageArmyThreshold = 2,
    researchArmyThreshold = 1,
    researchFirst = false
  } = {}) {
    this.playerId = playerId;
    this.random = createRng(`${seed}:${playerId}`);
    this.aggression = aggression;
    this.maxVillagers = maxVillagers;
    this.desiredArmy = desiredArmy;
    this.maxArmy = maxArmy;
    this.villagerCadence = villagerCadence;
    this.ageArmyThreshold = ageArmyThreshold;
    this.researchArmyThreshold = researchArmyThreshold;
    this.researchFirst = researchFirst;
    this.memory = {
      hubHexId: null,
      rejectedActions: 0,
      successfulActions: 0,
      passes: 0
    };
  }

  player(game) {
    return game.playerMap.get(this.playerId);
  }

  hub(game) {
    const viable = h => h && ['plain','desert'].includes(h.terrain) &&
      !h.special && !h.source &&
      game.state.buildings.filter(b=>b.hexId===h.id&&b.type==='farm').length<2;
    const remembered = this.memory.hubHexId
      ? game.hexMap.get(this.memory.hubHexId) : null;
    const linked=game.state.logisticsNetworkEnabled ? new Set(this.connectedIds(game)) : null;
    if (viable(remembered) && (!linked||linked.has(remembered.id))) return remembered;

    const tc = game.hexMap.get(this.player(game).tcHexId);
    const villagers = this.villagers(game);
    const locations = game.state.hexes.filter(viable).map(h=>{
      const routes=villagers.map(v=>strategicLandPath(game,v.hexId,h.id))
        .filter(Boolean);
      if (!routes.length) return null;
      const distance=Math.min(...routes.map(p=>p.length-1));
      const tcDistance=tc?hexDistance(h,tc):0;
      const sources=physicalNeighbors(game.state.hexes,h.id)
        .filter(n=>SOURCE_TO_RESOURCE[n.source]).length;
      return {h,score:distance*5+tcDistance*2-sources*2+(linked&&!linked.has(h.id)?100:0)};
    }).filter(Boolean).sort((a,b)=>a.score-b.score||a.h.id.localeCompare(b.h.id));
    const chosen=locations[0]?.h || null;
    if(chosen) this.memory.hubHexId=chosen.id;
    return chosen || tc;
  }

  ownUnits(game, predicate = () => true) {
    return game.state.units.filter(
      u => u.ownerId === this.playerId && !u.embarkedIn && predicate(u)
    );
  }

  villagers(game) {
    return this.ownUnits(game, u => u.type === 'villager');
  }

  military(game) {
    return this.ownUnits(game, u => game.effectiveUnitSpec(this.playerId, u.type).category === 'military');
  }

  barracks(game) {
    return game.state.buildings.find(
      b => b.ownerId === this.playerId && b.type === 'barracks'
    ) || null;
  }

  connectedIds(game) {
    return game.logisticsConnectedHexIds(this.playerId);
  }

  controlledResources(game) {
    return sumResources(game, game.state.logisticsNetworkEnabled
      ? this.connectedIds(game) : game.controlledHexIds(this.playerId));
  }

  // A valuable corridor is one whose loss disconnects several owned hexes.
  corridorValue(game, hexId, ownerId) {
    const connected=new Set(game.logisticsConnectedHexIds(ownerId));
    if(!connected.has(hexId)||hexId===game.playerMap.get(ownerId)?.tcHexId) return 0;
    const other=new Set([...connected].filter(id=>id!==hexId));
    const queue=[game.playerMap.get(ownerId).tcHexId], seen=new Set(queue);
    for(let i=0;i<queue.length;i++){
      for(const h of physicalNeighbors(game.state.hexes,queue[i])){
        if(other.has(h.id)&&!seen.has(h.id)){seen.add(h.id);queue.push(h.id)}
      }
    }
    return other.size-seen.size;
  }

  // Try restoring an isolated productive territory from the existing network.
  reconnectNetwork(game) {
    if(!game.state.logisticsNetworkEnabled)return {ok:false};
    const linked=new Set(this.connectedIds(game));
    const isolated=game.controlledHexIds(this.playerId)
      .filter(id=>!linked.has(id));
    if(!isolated.length)return {ok:false};
    const candidates=this.villagers(game).flatMap(v=>isolated.map(id=>{
      const path=strategicLandPath(game,v.hexId,id);
      return path?{v,id,path}:null;
    }).filter(Boolean)).sort((a,b)=>a.path.length-b.path.length);
    for(const c of candidates){
      const step=c.path[1];
      if(!step)continue;
      // Moving a unit off an occupied bottleneck can disconnect it; do not
      // abandon a corridor without a remaining building or unit there.
      if(this.corridorValue(game,c.v.hexId,this.playerId)>0 &&
         !game.state.buildings.some(b=>b.ownerId===this.playerId&&b.hexId===c.v.hexId) &&
         this.ownUnits(game,u=>u.hexId===c.v.hexId).length===1)continue;
      const result=this.safe(game,'reconnect-network',()=>game.moveUnits(this.playerId,[c.v.id],step));
      if(result.ok)return result;
    }
    return {ok:false};
  }

  localResources(game, hexId) {
    if(game.state.logisticsNetworkEnabled &&
       game.logisticsConnectedHexIds(this.playerId).includes(hexId)){
      return sumResources(game,game.logisticsConnectedHexIds(this.playerId));
    }
    return game.resourcesAt(hexId);
  }

  safe(game, label, fn) {
    try {
      const value = fn();
      this.memory.successfulActions++;
      return { ok: true, label, value };
    } catch (error) {
      this.memory.rejectedActions++;
      return { ok: false, label, error };
    }
  }

  ensureFreeCargoOps(game) {
    const hub = this.hub(game);
    for (const villager of this.villagers(game)) {
      if (villager.hexId === hub.id && villager.cargo?.length) {
        this.safe(game, 'unload', () => game.unloadAll(this.playerId, villager.id));
      }
    }
  }

  loadUsefulCargo(game, villager, target = null) {
    if (!villager || villager.cargo?.length >= game.effectiveUnitSpec(this.playerId, villager.type).carry) {
      return;
    }

    const hex = game.hexMap.get(villager.hexId);
    if (!hex) return;

    const preferred =
      target ||
      SOURCE_TO_RESOURCE[hex.source] ||
      RESOURCE_TYPES.find(r => hex.looseResources.some(t => t.type === r));

    if (!preferred) return;

    const capacity = game.effectiveUnitSpec(this.playerId, villager.type).carry;
    const free = Math.max(0, capacity - villager.cargo.length);
    const available = hex.looseResources.filter(t => t.type === preferred).length;
    const amount = Math.min(free, available);
    if (amount > 0) {
      this.safe(game, 'load', () => game.loadResource(this.playerId, villager.id, preferred, amount));
    }
  }

  nextLandStep(game, fromHexId, toHexId) {
    const path = strategicLandPath(game, fromHexId, toHexId);
    return path?.[1] || null;
  }

  resourceDeficits(game) {
    const hub = this.hub(game);
    const barracks = this.barracks(game);
    const target = barracks ? HUB_TARGET_AFTER_BARRACKS : HUB_TARGET_BEFORE_BARRACKS;
    const have = this.localResources(game, hub.id);
    const deficits = {};
    for (const r of RESOURCE_TYPES) deficits[r] = Math.max(0, (target[r] || 0) - (have[r] || 0));
    return deficits;
  }

  mostNeededResource(game) {
    const deficits = this.resourceDeficits(game);
    const ranked = Object.entries(deficits)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    return ranked[0]?.[0] || (this.barracks(game) ? 'food' : 'stone');
  }

  sourceCandidates(game, resourceType) {
    return game.state.hexes.filter(h =>
      h.terrain !== 'water' &&
      SOURCE_TO_RESOURCE[h.source] === resourceType
    );
  }

  nearestSourceFor(game, unit, resourceType) {
    const candidates = this.sourceCandidates(game, resourceType)
      .map(h => {
        const path = strategicLandPath(game, unit.hexId, h.id);
        return { h, path };
      })
      .filter(x => x.path)
      .sort((a, b) => a.path.length - b.path.length);

    const bestLength = candidates[0]?.path.length;
    const best = candidates.filter(x => x.path.length === bestLength);
    return pickRandom(best, this.random) || null;
  }

  productiveSelections(game) {
    const player = this.player(game);
    const occupied = new Set(this.villagers(game).map(v => v.hexId));
    const deficits = this.resourceDeficits(game);
    const options = [];

    for (const id of occupied) {
      const h = game.hexMap.get(id);
      if (!h || h.terrain === 'water') continue;
      const farms = game.state.buildings.some(
        b => b.ownerId === this.playerId && b.type === 'farm' && b.hexId === id
      );
      const sourceResource = SOURCE_TO_RESOURCE[h.source];
      if (sourceResource && deficits[sourceResource] > 0) {
        options.push({ hexId: id, mode: 'source' });
      } else if (farms && deficits.food > 0) {
        options.push({ hexId: id, mode: 'source' });
      } else if (
        deficits.food > 0 &&
        physicalNeighbors(game.state.hexes, id).some(n => n.terrain === 'water')
      ) {
        options.push({ hexId: id, mode: 'coast' });
      }
    }

    const limit = { dark: 2, feudal: 3, castles: 4, imperial: 5 }[player.age] || 2;

    return options
      .sort((a, b) => {
        const ha = game.hexMap.get(a.hexId);
        const hb = game.hexMap.get(b.hexId);
        const need = this.mostNeededResource(game);
        const ra = SOURCE_TO_RESOURCE[ha.source] === need ? 1 : 0;
        const rb = SOURCE_TO_RESOURCE[hb.source] === need ? 1 : 0;
        return rb - ra;
      })
      .slice(0, limit);
  }

  afterProductionLoad(game, results = []) {
    if(game.state.logisticsNetworkEnabled)return;
    const hub = this.hub(game);
    for (const result of results) {
      if (result.hexId === hub.id) continue;
      const workers = this.villagers(game).filter(v => v.hexId === result.hexId);
      for (const worker of workers) {
        this.loadUsefulCargo(game, worker, result.resourceType);
      }
    }
  }

  moveLogistics(game) {
    if(game.state.logisticsNetworkEnabled){
      const repaired=this.reconnectNetwork(game);
      if(repaired.ok)return repaired;
    }
    const hub = this.hub(game);
    const villagers = shuffle(this.villagers(game), this.random);

    for (const villager of villagers) {
      if (game.state.logisticsNetworkEnabled &&
          this.connectedIds(game).includes(villager.hexId))continue;
      if (villager.cargo?.length && villager.hexId !== hub.id) {
        const step = this.nextLandStep(game, villager.hexId, hub.id);
        if (!step) continue;
        const moved = this.safe(game, 'return-cargo', () =>
          game.moveUnits(this.playerId, [villager.id], step)
        );
        if (moved.ok) {
          if (villager.hexId === hub.id) this.ensureFreeCargoOps(game);
          return moved;
        }
      }
    }

    const deficits = this.resourceDeficits(game);
    const resourceOrder = Object.entries(deficits)
      .filter(([, amount]) => amount > 0)
      .sort((a,b) => b[1]-a[1])
      .map(([type]) => type);

    for (const villager of villagers) {
      if (villager.cargo?.length) continue;

      const currentHex = game.hexMap.get(villager.hexId);
      const currentResource = SOURCE_TO_RESOURCE[currentHex?.source];

      if (currentResource && deficits[currentResource] > 0) {
        if(game.state.logisticsNetworkEnabled&&this.connectedIds(game).includes(villager.hexId))continue;
        this.loadUsefulCargo(game, villager, currentResource);

        if (villager.cargo?.length) {
          const step = this.nextLandStep(game, villager.hexId, hub.id);
          if (step) {
            const moved = this.safe(game, 'return-loaded-resource', () =>
              game.moveUnits(this.playerId, [villager.id], step)
            );
            if (moved.ok) return moved;
          }
        }

        // Si acaba de llegar a un recurso sin fichas producidas todavía,
        // no lo saques durante la fase Militar: debe esperar a la próxima
        // Economía para poder PRODUCIR.
        continue;
      }

      for (const needed of resourceOrder) {
        const source = this.nearestSourceFor(game, villager, needed);
        if (!source) continue;

        if (source.h.id === villager.hexId) {
          this.loadUsefulCargo(game, villager, needed);
          continue;
        }

        const step = source.path[1];
        if (!step) continue;
        const moved = this.safe(game, 'seek-resource', () =>
          game.moveUnits(this.playerId, [villager.id], step)
        );
        if (moved.ok) return moved;
      }
    }

    return { ok: false, label: 'logistics-none' };
  }

  tryTrainVillager(game) {
    const villagers = this.villagers(game);
    if (villagers.length >= this.maxVillagers) return { ok: false };

    const rule = game.unitRule(this.playerId, 'villager');
    if (!rule) return { ok: false };
    const cost = game.effectiveUnitCost(this.playerId, 'villager', rule.cost);
    if (!canPay(this.controlledResources(game), cost)) return { ok: false };

    return this.safe(game, 'train-villager', () =>
      game.trainUnits(this.playerId, [{ type: 'villager' }])
    );
  }

  takeEconomy(game) {
    this.ensureFreeCargoOps(game);

    const hub = this.hub(game);
    const hasCargoAway = this.villagers(game).some(
      v => v.hexId !== hub.id && (v.cargo?.length || 0) > 0 &&
        (!game.state.logisticsNetworkEnabled||!this.connectedIds(game).includes(v.hexId))
    );

    if (hasCargoAway) {
      const returning = this.moveLogistics(game);
      if (returning.ok) return returning;
    }

    if (game.state.round % this.villagerCadence === 0) {
      const trained = this.tryTrainVillager(game);
      if (trained.ok) return trained;
    }

    const selections = game.state.autoProductionEnabled ? [] : this.productiveSelections(game);
    if (selections.length) {
      const produced = this.safe(game, 'produce', () =>
        game.produce(this.playerId, selections)
      );
      if (produced.ok) {
        this.afterProductionLoad(game, produced.value);
        return produced;
      }
    }

    const moved = this.moveLogistics(game);
    if (moved.ok) return moved;

    const trained = this.tryTrainVillager(game);
    if (trained.ok) return trained;

    return { ok: false };
  }

  tryBuildBarracks(game) {
    if (this.barracks(game)) return { ok: false };

    const hub = this.hub(game);
    const villager = this.villagers(game).find(v => v.hexId === hub.id);
    const rule = game.buildingRule(this.playerId, 'barracks');
    if (!villager || !rule || !canPay(this.localResources(game, hub.id), rule.cost)) {
      return { ok: false };
    }

    return this.safe(game, 'build-barracks', () =>
      game.build(this.playerId, 'barracks', hub.id, villager.id)
    );
  }

  affordableMilitaryAt(game, building) {
    const available = game.availableUnits(this.playerId)
      .filter(u => u.category === 'military')
      .filter(u => !u.provisionalCost)
      .filter(u => u.training.some(t => t.building === building.type))
      .sort((a, b) => {
        const pa = MILITARY_PRIORITY.indexOf(a.type);
        const pb = MILITARY_PRIORITY.indexOf(b.type);
        return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      });

    const have = this.localResources(game, building.hexId);
    for (const unit of available) {
      const option = unit.training.find(t => t.building === building.type);
      if (option && canPay(have, option.cost)) return unit;
    }
    return null;
  }

  tryTrainMilitary(game) {
    if (this.military(game).length >= this.maxArmy) return { ok: false };

    const buildings = game.state.buildings.filter(
      b => b.ownerId === this.playerId && ['barracks','castle','port','siege'].includes(b.type)
    );

    for (const building of buildings) {
      const unit = this.affordableMilitaryAt(game, building);
      if (!unit) continue;
      const result = this.safe(game, 'train-military', () =>
        game.trainUnits(this.playerId, [{ type: unit.type, buildingId: building.id }])
      );
      if (result.ok) return result;
    }
    return { ok: false };
  }

  combatStacks(game) {
    const map = new Map();
    for (const u of this.military(game)) {
      if (!map.has(u.hexId)) map.set(u.hexId, []);
      map.get(u.hexId).push(u);
    }
    return [...map.entries()]
      .map(([hexId, units]) => ({ hexId, units, force: forceOf(game, this.playerId, units) }))
      .sort((a, b) => b.force - a.force || b.units.length - a.units.length);
  }

  enemyTargets(game, fromHexId) {
    const alive = game.state.players.filter(p => !p.eliminated && p.id !== this.playerId);

    return alive.map(player => {
      const target = game.hexMap.get(player.tcHexId);
      const path = strategicLandPath(game, fromHexId, target.id);
      const enemyMilitary = game.state.units.filter(
        u =>
          u.ownerId === player.id &&
          game.effectiveUnitSpec(player.id, u.type).category === 'military'
      );
      const armyForce = forceOf(game, player.id, enemyMilitary);
      const structures = game.state.buildings.filter(b => b.ownerId === player.id).length;
      const tacticalCorridors=game.state.logisticsNetworkEnabled
        ? game.logisticsConnectedHexIds(player.id).filter(id=>this.corridorValue(game,id,player.id)>0)
        : [];
      const corridorPaths=tacticalCorridors.map(id=>({id,path:strategicLandPath(game,fromHexId,id)}))
        .filter(x=>x.path).sort((a,b)=>a.path.length-b.path.length);
      const strategic=corridorPaths[0];
      const useCorridor=strategic&&strategic.path.length<(path?.length||999) &&
        this.military(game).length>=2;
      const chosenPath=useCorridor?strategic.path:path;
      const score=(chosenPath?.length||999)*2+armyForce+structures*.5-(useCorridor?3:0);
      return {
        player,
        target:useCorridor?game.hexMap.get(strategic.id):target,
        path:chosenPath,
        armyForce,
        score,
        tieBreak:stableTargetTie(game.state.mapMeta?.seed || '',this.playerId,player.id)
      };
    })
      .filter(x => x.path)
      .sort((a, b) =>
        a.score - b.score ||
        a.path.length - b.path.length ||
        a.tieBreak - b.tieBreak
      );
  }

  defenseBid(game, defenderId, targetHexId, attackerForce) {
    const defender = game.playerMap.get(defenderId);
    if (!defender) return 0;
    const parts = game.combatParticipants(defenderId, targetHexId, []);
    const force = game.combatForceBreakdown(defenderId, parts, [], targetHexId, {
      role: 'defender',
      directIds: []
    }).total;
    const max = game.maxBidFor(defenderId, {
      role: 'defender',
      participants: parts,
      targetHexId
    });
    const desired = Math.max(0, attackerForce - force);
    return Math.min(max, desired, Math.max(0, Math.ceil(defender.militaryPower * 0.6)));
  }

  attackBid(game, direct, targetHexId, defenderBid) {
    const targetMilitary = game.state.units.filter(
      u => u.hexId === targetHexId && u.ownerId !== this.playerId && game.isCombatParticipant(u.ownerId, u)
    );
    const defenderId = targetMilitary[0]?.ownerId ||
      game.state.buildings.find(b => b.hexId === targetHexId && b.ownerId !== this.playerId)?.ownerId ||
      game.hexMap.get(targetHexId)?.tcOwnerId;

    if (!defenderId) return { attackerBid: 0, defenderBid: 0 };

    const atkParts = game.combatParticipants(this.playerId, targetHexId, direct.map(u => u.id));
    const defParts = game.combatParticipants(defenderId, targetHexId, []);
    const atkForce = game.combatForceBreakdown(this.playerId, atkParts, defParts, targetHexId, {
      role: 'attacker',
      directIds: direct.map(u => u.id)
    }).total;
    const defForce = game.combatForceBreakdown(defenderId, defParts, atkParts, targetHexId, {
      role: 'defender',
      directIds: []
    }).total;

    const max = game.maxBidFor(this.playerId, {
      role: 'attacker',
      participants: atkParts,
      targetHexId
    });

    const desired = Math.max(0, defForce + defenderBid - atkForce + 1);
    return {
      attackerBid: Math.min(max, desired),
      defenderBid
    };
  }

  tryArmyAction(game) {
    const stacks = this.combatStacks(game);
    if (!stacks.length) return { ok: false };

    for (const stack of stacks) {
      const direct = stack.units.filter(u => {
        const spec = game.effectiveUnitSpec(this.playerId, u.type);
        return spec.move > 0 && !spec.water;
      });
      if (!direct.length) continue;

      const targets = this.enemyTargets(game, stack.hexId);

      for (const chosen of targets) {
        const nextId = chosen.path[1];
        if (!nextId) continue;

        const enemyMilitary = game.state.units.filter(
          u =>
            u.hexId === nextId &&
            u.ownerId !== this.playerId &&
            game.isCombatParticipant(u.ownerId, u)
        );

        const enemyBuilding = game.state.buildings.some(
          b => b.hexId === nextId && b.ownerId !== this.playerId
        );
        const targetHex = game.hexMap.get(nextId);
        const enemyTC =
          targetHex?.special === 'tc' &&
          targetHex.tcOwnerId &&
          targetHex.tcOwnerId !== this.playerId;

        if (enemyMilitary.length) {
          const defenderId = enemyMilitary[0].ownerId;
          const atkParts = game.combatParticipants(
            this.playerId,
            nextId,
            direct.map(u => u.id)
          );
          const defParts = game.combatParticipants(defenderId, nextId, []);
          const atkForce = game.combatForceBreakdown(
            this.playerId,
            atkParts,
            defParts,
            nextId,
            { role:'attacker', directIds:direct.map(u => u.id) }
          ).total;
          const defenderBid = this.defenseBid(game, defenderId, nextId, atkForce);
          const bids = this.attackBid(game, direct, nextId, defenderBid);

          const defenderForce = game.combatForceBreakdown(
            defenderId,
            defParts,
            atkParts,
            nextId,
            { role:'defender', directIds:[] }
          ).total;

          const favorable =
            atkForce + bids.attackerBid >
            defenderForce + defenderBid;

          if (!favorable && this.random() > this.aggression) {
            continue;
          }

          const attack = this.safe(game, 'attack', () =>
            game.attack(this.playerId, {
              unitIds:direct.map(u => u.id),
              targetHexId:nextId,
              attackerBid:bids.attackerBid,
              defenderBid:bids.defenderBid
            })
          );
          if (attack.ok) return attack;
          continue;
        }

        if (enemyBuilding || enemyTC || !enemyMilitary.length) {
          const result = this.safe(game, 'advance-army', () =>
            game.moveUnits(this.playerId, direct.map(u => u.id), nextId)
          );
          if (result.ok) return result;
        }
      }
    }

    return { ok: false };
  }

  takeTechnology(game) {
    const player = this.player(game);
    const armyCount = this.military(game).length;
    const controlled = this.controlledResources(game);
    const ageIndex = AGES.indexOf(player.age);

    const tryResearch = () => {
      if (armyCount < this.researchArmyThreshold) return { ok: false };

      const affordable = game.availableTechnologies(this.playerId)
        .filter(t => canPay(controlled, t.cost))
        .sort((a, b) => costWeight(a.cost) - costWeight(b.cost));

      if (!affordable.length) return { ok: false };

      const cheapest = affordable.filter(
        t => costWeight(t.cost) === costWeight(affordable[0].cost)
      );
      const tech = pickRandom(cheapest, this.random);
      return this.safe(game, 'research', () =>
        game.research(this.playerId, tech.id)
      );
    };

    const tryAdvance = () => {
      if (
        armyCount < this.ageArmyThreshold ||
        ageIndex >= AGES.length - 1
      ) return { ok: false };

      const next = AGES[ageIndex + 1];
      if (!canPay(controlled, AGE_COSTS[next])) return { ok: false };

      return this.safe(game, 'advance-age', () =>
        game.advanceAge(this.playerId)
      );
    };

    if (this.researchFirst) {
      const researched = tryResearch();
      if (researched.ok) return researched;
      const advanced = tryAdvance();
      if (advanced.ok) return advanced;
    } else {
      const advanced = tryAdvance();
      if (advanced.ok) return advanced;
      const researched = tryResearch();
      if (researched.ok) return researched;
    }

    return { ok: false };
  }

  takeMilitary(game) {
    this.ensureFreeCargoOps(game);

    const built = this.tryBuildBarracks(game);
    if (built.ok) return built;

    const army = this.military(game);

    if (army.length < this.desiredArmy) {
      const rearmed = this.tryTrainMilitary(game);
      if (rearmed.ok) return rearmed;
    }

    if (army.length >= 2) {
      const action = this.tryArmyAction(game);
      if (action.ok) return action;
    }

    if (army.length < this.maxArmy) {
      const trained = this.tryTrainMilitary(game);
      if (trained.ok) return trained;
    }

    if (army.length) {
      const action = this.tryArmyAction(game);
      if (action.ok) return action;
    }

    const logistics = this.moveLogistics(game);
    if (logistics.ok) return logistics;

    const controlled = this.controlledResources(game);
    if ((controlled.gold || 0) > 0 && this.player(game).militaryPower < 16) {
      const instructed = this.safe(game, 'instruct', () => game.instruct(this.playerId));
      if (instructed.ok) return instructed;
    }

    return { ok: false };
  }

  takePhase(game) {
    if (game.activePlayer.id !== this.playerId || game.state.winnerId) {
      return { ok: false, label: 'not-active' };
    }

    let result = { ok: false };
    if (game.state.phase === 'economy') result = this.takeEconomy(game);
    else if (game.state.phase === 'technology') result = this.takeTechnology(game);
    else if (game.state.phase === 'military') result = this.takeMilitary(game);

    if (!result.ok && !game.state.actionUsed) {
      const passed = this.safe(game, 'pass', () => game.pass(this.playerId));
      if (passed.ok) this.memory.passes++;
      return passed;
    }

    return result;
  }
}
