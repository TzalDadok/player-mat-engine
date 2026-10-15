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

// The terrain graph is constant throughout most bot decisions; building it once
// avoids repeated full-map scans and sorting during every BFS expansion.
const routeGraphs=new WeakMap();
function strategicLandPath(game, fromId, toId) {
  if(fromId===toId)return [fromId];
  let cache=routeGraphs.get(game.state.hexes);
  if(!cache){
    const byId=new Map(game.state.hexes.map(h=>[h.id,h]));
    const neighbors=new Map();
    for(const h of game.state.hexes){
      neighbors.set(h.id,physicalNeighbors(game.state.hexes,h.id)
        .filter(n=>n.terrain!=='water')
        .sort((a,b)=>a.q-b.q||a.r-b.r).map(n=>n.id));
    }
    cache={byId,neighbors};
    routeGraphs.set(game.state.hexes,cache);
  }
  const goal=cache.byId.get(toId);
  if(!goal||goal.terrain==='water'||!cache.byId.has(fromId))return null;
  const queue=[fromId],prev=new Map([[fromId,null]]);
  for(let index=0;index<queue.length;index++){
    if((index&15)===0&&game._botDeadline&&performance.now()>game._botDeadline){
      const e=new Error('Decision budget exceeded');e.code='BOT_BUDGET_EXCEEDED';throw e;
    }
    const id=queue[index];
    for(const next of cache.neighbors.get(id)||[]){
      if(prev.has(next)||game.edgeBlocked(id,next))continue;
      prev.set(next,id);
      if(next===toId){
        const path=[];let cur=next;
        while(cur!==null){path.push(cur);cur=prev.get(cur)}
        return path.reverse();
      }
      queue.push(next);
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
    this.decisionBudgetMs = 80;
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
    if(game.state.logisticsNetworkEnabled){
      const linked=new Set(this.connectedIds(game));
      const occupied=this.villagers(game).map(v=>game.hexMap.get(v.hexId))
        .find(h=>h&&linked.has(h.id)&&['plain','desert'].includes(h.terrain)&&!h.source&&!h.special);
      if(occupied)return occupied;
      const tc=game.hexMap.get(this.player(game).tcHexId);
      return physicalNeighbors(game.state.hexes,tc.id)
        .find(h=>['plain','desert'].includes(h.terrain)&&!h.source&&!h.special)||tc;
    }
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
      const secured=linked?.has(h.id);
      const occupier=villagers.some(v=>v.hexId===h.id);
      const adjacentToNetwork=linked&&physicalNeighbors(game.state.hexes,h.id).some(n=>linked.has(n.id));
      return {h,score:distance*5+tcDistance*2-sources*2+(linked?(secured?-200:adjacentToNetwork?-70:150):0)-(occupier?30:0)};
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
  enemyCorridors(game,enemyId) {
    const signature=game.state.round+':'+game.state.log.length+':'+enemyId;
    if(!this._corridorCache)this._corridorCache=new Map();
    if(this._corridorCache.has(signature))return this._corridorCache.get(signature);
    if(this._corridorCache.size>30)this._corridorCache.clear();
    const connected=game.logisticsConnectedHexIds(enemyId);
    // Only evaluate owned hexes with 2+ connected neighbors (possible choke points).
    const set=new Set(connected);
    const candidates=connected.filter(id=>id!==game.playerMap.get(enemyId).tcHexId&&
      physicalNeighbors(game.state.hexes,id).filter(n=>set.has(n.id)).length>=2);
    const result=candidates.filter(id=>this.corridorValue(game,id,enemyId)>0);
    this._corridorCache.set(signature,result);
    return result;
  }

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
  safeToVacate(game,unit) {
    if(!game.state.logisticsNetworkEnabled)return true;
    const other=this.ownUnits(game,u=>u.id!==unit.id&&u.hexId===unit.hexId).length;
    if(other||game.state.buildings.some(b=>b.ownerId===this.playerId&&b.hexId===unit.hexId))return true;
    // Never abandon the only anchor of an active network segment.
    const hex=game.hexMap.get(unit.hexId);
    if(SOURCE_TO_RESOURCE[hex?.source]&&this.connectedIds(game).includes(unit.hexId))return false;
    return !this.connectedIds(game).includes(unit.hexId) ||
      this.corridorValue(game,unit.hexId,this.playerId)===0;
  }

  prepareBarracksSite(game) {
    if(!game.state.logisticsNetworkEnabled||this.barracks(game))return {ok:false};
    const rule=game.buildingRule(this.playerId,'barracks');
    if(!rule||!canPay(this.controlledResources(game),rule.cost))return {ok:false};
    const linked=new Set(this.connectedIds(game));
    const targets=game.state.hexes.filter(h=>
      ['plain','desert'].includes(h.terrain)&&!h.source&&!h.special&&
      (linked.has(h.id)||physicalNeighbors(game.state.hexes,h.id).some(n=>linked.has(n.id)))
    );
    const moves=[];
    for(const v of this.villagers(game)){
      if(!this.safeToVacate(game,v))continue;
      for(const h of targets){
        if(h.id===v.hexId)continue;
        if(hexDistance(game.hexMap.get(v.hexId),h)!==1)continue;
        const step=h;
        if(!step||step.terrain==='water')continue;
        // The destination must be supplied immediately after movement.
        if(!linked.has(step.id)&&!physicalNeighbors(game.state.hexes,step.id).some(n=>linked.has(n.id)))continue;
        moves.push({v,h,step,score:linked.has(h.id)?0:1});
      }
    }
    moves.sort((a,b)=>a.score-b.score);
    for(const m of moves.slice(0,8)){
      const r=this.safe(game,'prepare-barracks',()=>game.moveUnits(this.playerId,[m.v.id],m.step.id));
      if(r.ok)return r;
    }
    return {ok:false};
  }

  networkExpansion(game) {
    if(!game.state.logisticsNetworkEnabled)return {ok:false};
    const linked=new Set(this.connectedIds(game));
    const candidates=[];
    const need=this.resourceDeficits(game);
    for(const v of this.villagers(game)){
      if(!this.safeToVacate(game,v))continue;
      const occupied=linked.has(v.hexId);
      for(const h of physicalNeighbors(game.state.hexes,v.hexId)){
        if(h.terrain==='water'||game.controllerOf(h.id)===this.playerId)continue;
        const adjacent=physicalNeighbors(game.state.hexes,h.id).some(n=>linked.has(n.id));
        if(!adjacent)continue;
        const resource=SOURCE_TO_RESOURCE[h.source]?1:0;
        const hub=this.memory.hubHexId===h.id?1:0;
        const needsSite=!this.barracks(game)&&canPay(this.controlledResources(game),game.buildingRule(this.playerId,'barracks')?.cost||{});
        const buildSite=['plain','desert'].includes(h.terrain)&&!h.source&&!h.special;
        const type=SOURCE_TO_RESOURCE[h.source];
        const score=(type&&need[type]>0?25:0)+resource*3+hub*2+(occupied?1:0)+(needsSite&&buildSite?12:0);
        candidates.push({v,h,score});
      }
    }
    candidates.sort((a,b)=>b.score-a.score||a.h.id.localeCompare(b.h.id));
    for(const {v,h} of candidates.slice(0,8)){
      const result=this.safe(game,'expand-network',()=>game.moveUnits(this.playerId,[v.id],h.id));
      if(result.ok)return result;
    }
    return {ok:false};
  }

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
      if(!this.safeToVacate(game,c.v))continue;
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
    const hub = game.state.logisticsNetworkEnabled ? game.hexMap.get(this.player(game).tcHexId) : this.hub(game);
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
    const have = game.state.logisticsNetworkEnabled ? this.controlledResources(game) : this.localResources(game, hub.id);
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

  logisticsCourier(game) {
    if(!game.state.logisticsNetworkEnabled)return {ok:false};
    const tcId=this.player(game).tcHexId;
    const deficits=this.resourceDeficits(game);
    const villagers=this.villagers(game);
    // Deliver cargo first. Loads and unloads do not consume the phase action.
    for(const v of villagers.filter(v=>v.cargo?.length)){
      if(v.hexId===tcId){
        this.safe(game,'courier-unload',()=>game.unloadAll(this.playerId,v.id));
        continue;
      }
      const step=this.nextLandStep(game,v.hexId,tcId);
      if(step)return this.safe(game,'courier-return',()=>game.moveUnits(this.playerId,[v.id],step));
    }
    const needs=Object.entries(deficits).filter(([,n])=>n>0);
    if(!needs.length)return {ok:false};
    // Keep a destination while travelling: recomputing a best source every
    // phase produced loops between unrelated resource hexes.
    const assignments=this.memory.courierAssignments||(this.memory.courierAssignments={});
    const idle=villagers.filter(v=>!v.cargo?.length);
    const priority={stone:0,wood:1,gold:2,food:3};
    const orders=[];
    for(const v of idle){
      const saved=assignments[v.id];
      if(saved&&deficits[saved.resource]>0&&game.state.round-(saved.sinceRound||game.state.round)<6){
        const target=game.hexMap.get(saved.hexId);
        if(target&&target.terrain!=='water'){
          const path=strategicLandPath(game,v.hexId,target.id);
          if(path)orders.push({v,resource:saved.resource,target,path,score:-100});
        }
      }
      for(const [resource,amount] of needs){
        for(const target of this.sourceCandidates(game,resource)){
          const path=strategicLandPath(game,v.hexId,target.id);
          if(!path)continue;
          const stocked=game.resourcesAt(target.id)[resource]||0;
          const distance=path.length-1;
          const score=distance*2-(stocked?6:0)+priority[resource]*5-
            Math.min(amount,4);
          orders.push({v,resource,target,path,score});
        }
      }
    }
    orders.sort((a,b)=>a.score-b.score||a.target.id.localeCompare(b.target.id));
    for(const order of orders.slice(0,12)){
      const {v,target,resource,path}=order;
      if(v.hexId===target.id){
        const amount=game.resourcesAt(target.id)[resource]||0;
        if(amount){
          this.loadUsefulCargo(game,v,resource);
          if(v.cargo?.length){
            delete assignments[v.id];
            const home=this.nextLandStep(game,v.hexId,tcId);
            if(home)return this.safe(game,'courier-loaded-return',()=>game.moveUnits(this.playerId,[v.id],home));
          }
        }
        // Stay on the selected source until the next manual production.
        assignments[v.id]={hexId:target.id,resource,sinceRound:assignments[v.id]?.hexId===target.id&&assignments[v.id]?.resource===resource?assignments[v.id].sinceRound:game.state.round};
        continue;
      }
      const moved=this.safe(game,'courier-seek',()=>game.moveUnits(this.playerId,[v.id],path[1]));
      if(moved.ok){
        assignments[v.id]={hexId:target.id,resource,sinceRound:assignments[v.id]?.hexId===target.id&&assignments[v.id]?.resource===resource?assignments[v.id].sinceRound:game.state.round};
        return moved;
      }
    }
    return {ok:false};
  }

  moveLogistics(game) {
    if(game.state.logisticsNetworkEnabled){
      return this.logisticsCourier(game);
    }
    if(game.state.logisticsNetworkEnabled){
      const constructed=this.prepareBarracksSite(game);
      if(constructed.ok)return constructed;
      const expanded=this.networkExpansion(game);
      if(expanded.ok)return expanded;
    }
    const hub = this.hub(game);
    const villagers = shuffle(this.villagers(game), this.random);

    for (const villager of villagers) {
      if (game.state.logisticsNetworkEnabled &&
          !this.safeToVacate(game,villager))continue;
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
      if (villager.cargo?.length || !this.safeToVacate(game,villager)) continue;

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

  tryConsolidateResource(game) {
    if(!game.state.logisticsNetworkEnabled)return {ok:false};
    const linked=new Set(this.connectedIds(game));
    const owned=game.state.buildings.filter(b=>b.ownerId===this.playerId);
    for(const v of this.villagers(game)){
      if(!linked.has(v.hexId))continue;
      const h=game.hexMap.get(v.hexId);
      const type=['animals','berries'].includes(h?.source)?'mill':
        ['forest','stone','gold'].includes(h?.source)?'camp':null;
      if(!type||owned.some(b=>b.type===type))continue;
      const rule=game.buildingRule(this.playerId,type);
      if(!rule||!game.ageAllows(this.player(game),rule.age))continue;
      if(!canPay(this.localResources(game,h.id),rule.cost))continue;
      const built=this.safe(game,'consolidate-resource',()=>
        game.build(this.playerId,type,h.id,v.id));
      if(built.ok)return built;
    }
    return {ok:false};
  }

  takeEconomy(game) {
    this.ensureFreeCargoOps(game);
    const consolidated=this.tryConsolidateResource(game);
    if(consolidated.ok)return consolidated;

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
    const rule = game.buildingRule(this.playerId, 'barracks');
    const linked = game.state.logisticsNetworkEnabled ? new Set(this.connectedIds(game)) : null;
    const builder = this.villagers(game).filter(v => {
      const h=game.hexMap.get(v.hexId);
      return h && ['plain','desert'].includes(h.terrain) && !h.special && !h.source &&
        (!linked || linked.has(h.id)) && canPay(this.localResources(game,h.id),rule?.cost);
    }).sort((a,b)=>Number(b.hexId===hub.id)-Number(a.hexId===hub.id))[0];
    const villager = builder;
    const buildHexId = villager?.hexId || hub.id;
    if (!villager || !rule) {
      return { ok: false };
    }

    return this.safe(game, 'build-barracks', () =>
      game.build(this.playerId, 'barracks', buildHexId, villager.id)
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
      // Cache articulation points once per enemy and round, rather than
      // recomputing a flood-fill for every candidate, stack and action.
      const tacticalCorridors=game.state.logisticsNetworkEnabled
        ? this.enemyCorridors(game,player.id) : [];
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

    const start=performance.now();
    game._botDeadline=start+this.decisionBudgetMs;
    let result = { ok: false };
    try {
      if (game.state.phase === 'economy') result = this.takeEconomy(game);
      else if (game.state.phase === 'technology') result = this.takeTechnology(game);
      else if (game.state.phase === 'military') result = this.takeMilitary(game);
    } catch (error) {
      if(error?.code!=='BOT_BUDGET_EXCEEDED')throw error;
      result={ok:false};
    }
    game._botDeadline=null;
    if(performance.now()-start>this.decisionBudgetMs) this.memory.slowDecisions=(this.memory.slowDecisions||0)+1;
    if(!result.ok&&!game.state.actionUsed){
      // Cheap deterministic-seed random legal fallback, avoiding another
      // expensive strategic search. Passing is always legal.
      const units=this.ownUnits(game,u=>u.type==='villager'&&this.safeToVacate(game,u));
      if(units.length&&game.state.phase!=='technology'&&!game.state.logisticsNetworkEnabled){
        const u=pickRandom(units,this.random);
        const near=shuffle(physicalNeighbors(game.state.hexes,u.hexId)
          .filter(h=>h.terrain!=='water'),this.random);
        for(const h of near.slice(0,3)){
          const attempt=this.safe(game,'fallback-random-move',()=>
            game.moveUnits(this.playerId,[u.id],h.id));
          if(attempt.ok){this.memory.fallbacks=(this.memory.fallbacks||0)+1;return attempt;}
        }
      }
      this.memory.fallbacks=(this.memory.fallbacks||0)+1;
    }

    if (!result.ok && !game.state.actionUsed) {
      const passed = this.safe(game, 'pass', () => game.pass(this.playerId));
      if (passed.ok) this.memory.passes++;
      return passed;
    }

    return result;
  }
}
