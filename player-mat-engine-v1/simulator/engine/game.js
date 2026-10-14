import {
  PHASES, AGES, AGE_PRODUCTION_LIMIT, RESOURCE_TYPES, MAX_MILITARY_POWER, MAX_MILITARY_BID,
  UNIT_TYPES, BUILDING_TYPES, AGE_COSTS, SOURCE_TO_RESOURCE, EXHAUSTED_TO
} from './constants.js';
import { generateHexRadius, hexDistance, physicalNeighbors, shortestMovementPath } from './hex.js';
import { getCivilization } from '../civs/index.js';
import { generateFFA36Map, generateFFA60Map, autoPlaceFFAPlayerCUs } from '../maps/ffa36.js';
import { createExplorationState, cardById, shuffleCards } from './exploration.js';

const clone = v => structuredClone(v);
let seq = 1;
const uid = prefix => `${prefix}${seq++}`;

export class RuleError extends Error {
  constructor(message, code = 'RULE_ERROR') {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}

export class AoEGame {
  constructor(state) { this.state = state; }

  static create({
    players,
    radius = 2,
    seedMap = true,
    mode = 'ffa',
    mapHexes = null,
    explorationSeed = 'aevum-exploration'
  } = {}) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
      throw new RuleError('La partida requiere entre 2 y 4 jugadores.');
    }

    const hexes = mapHexes ? clone(mapHexes) : generateHexRadius(radius);
    if (seedMap && !mapHexes) AoEGame.seedDemoMap(hexes);

    const state = {
      version: 2,
      mode,
      round: 1,
      activePlayerIndex: 0,
      phase: 'economy',
      actionUsed: false,
      winnerId: null,
      hexes,
      players: players.map((p, i) => ({
        id: p.id || `P${i + 1}`,
        name: p.name || `Jugador ${i + 1}`,
        civ: p.civ || 'generic',
        age: 'dark',
        militaryPower: p.militaryPower ?? 0,
        maxMilitaryBid: p.maxMilitaryBid ?? MAX_MILITARY_BID,
        technologies: [],
        eliminated: false,
        tcHexId: null,
        stats: {
          villagersTrained: 0,
          militaryTrained: 0,
          trades: 0,
          buildingsConstructed: [],
          eliminations: 0,
          reached16MilitaryPower: false
        },
        eliminatedScore: null
      })),
      units: [],
      buildings: [],
      exploration: createExplorationState(explorationSeed),
      turnModifiers: {},
      log: []
    };

    const game = new AoEGame(state);
    game.setupPlayers();
    game.log('game-start', { mode, players: state.players.map(p => p.id) });
    return game;
  }

  static createFFA({
    players,
    seed = 'aevum-ffa',
    cuSelectionOrder = null,
    mapPreset = 'ffa36',
    requireTwoAdjacentLand = false
  } = {}) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
      throw new RuleError('FFA requiere entre 2 y 4 jugadores.');
    }

    const normalizedPlayers = players.map((p, i) => ({
      ...p,
      id: p.id || `P${i + 1}`
    }));
    if(!['ffa36','ffa60'].includes(mapPreset)) throw new RuleError('Mapa FFA desconocido.');
    const generator=mapPreset==='ffa60'?generateFFA60Map:generateFFA36Map;
    const map = generator({ seed, players: normalizedPlayers });
    const placements = autoPlaceFFAPlayerCUs(
      map,
      normalizedPlayers,
      { selectionOrder: cuSelectionOrder, minAdjacentLand:requireTwoAdjacentLand?2:0 }
    );

    const game = AoEGame.create({
      players: normalizedPlayers,
      seedMap: false,
      mode: 'ffa',
      mapHexes: map.hexes,
      explorationSeed: `${seed}:exploration`
    });

    game.state.mapMeta = {
      preset: map.preset,
      seed: map.seed,
      terrainIds: [...map.terrainIds],
      perimeterIds: [...map.perimeterIds],
      builders: clone(map.builders),
      placementHistory: clone(map.placementHistory),
      discardedTerrain: clone(map.discarded),
      cuSelectionOrder: placements.map(cu => cu.tcOwnerId),
      startPositions: placements.map(cu => ({
        playerId: cu.tcOwnerId,
        cuHexId: cu.id,
        anchorTerrainId: cu.tcAnchorId,
        startScore: cu.startScore,
        selectionIndex: cu.selectionIndex
      }))
    };

    game.log('ffa-map-created', {
      seed: map.seed,
      terrainCount: map.terrainIds.length,
      perimeterCount: map.perimeterIds.length,
      placements: map.placementHistory.length
    });

    return game;
  }

  static seedDemoMap(hexes) {
    const sources = ['forest', 'animals', 'stone', 'gold', 'berries', 'forest', 'animals', 'gold', 'stone'];
    let waterN = 0;

    hexes.forEach((hex, i) => {
      if (i % 11 === 0) hex.terrain = 'mountain';
      else if (i % 13 === 0) hex.terrain = 'desert';
      else if (i > 1 && i % 9 === 0) {
        hex.terrain = 'water';
        hex.waterLane = waterN++ % 2 ? 'B' : 'A';
      } else if (i % 7 === 0) {
        hex.terrain = 'forest';
      }

      hex.source =
        hex.terrain === 'water' || hex.terrain === 'mountain' || hex.terrain === 'desert'
          ? null
          : sources[i % sources.length];
    });

    const center = hexes.find(h => h.q === 0 && h.r === 0);
    if (center) {
      center.special = 'wonder';
      center.source = null;
      center.terrain = 'plain';
    }
  }

  setupPlayers() {
    const land = this.state.hexes.filter(
      h => h.terrain !== 'water' && h.special !== 'wonder' && h.special !== 'tc'
    );
    const starts = [
      land[0],
      land[land.length - 1],
      land[Math.floor(land.length / 3)],
      land[Math.floor(land.length * 2 / 3)]
    ];

    this.state.players.forEach((p, i) => {
      let hex = this.state.hexes.find(
        h => h.special === 'tc' && h.tcOwnerId === p.id
      );

      if (!hex) {
        hex = starts[i];
        if (!hex) throw new RuleError('No hay posición válida para Centro Urbano.');
        hex.special = 'tc';
        hex.category = 'special';
        hex.tcOwnerId = p.id;
        hex.source = null;
      }

      p.tcHexId = hex.id;

      if (!this.state.units.some(u => u.ownerId === p.id && u.type === 'villager')) {
        this.addUnit(p.id, 'villager', hex.id);
      }
    });
  }

  get activePlayer() { return this.state.players[this.state.activePlayerIndex]; }
  get hexMap() { return new Map(this.state.hexes.map(h => [h.id, h])); }
  get playerMap() { return new Map(this.state.players.map(p => [p.id, p])); }

  civFor(playerId) {
    const player = typeof playerId === 'string' ? this.playerMap.get(playerId) : playerId;
    if (!player) throw new RuleError('Jugador inexistente.');
    const civ = getCivilization(player.civ);
    if (!civ) throw new RuleError(`Civilización no integrada al simulador: ${player.civ}`, 'UNKNOWN_CIV');
    return civ;
  }

  technologyRule(playerId, technologyId) {
    return this.civFor(playerId).technologies.find(t => t.id === technologyId) || null;
  }

  activeEffects(playerId) {
    const player = this.playerMap.get(playerId);
    if (!player) return [];
    return player.technologies.flatMap(id => this.technologyRule(playerId, id)?.effects || []);
  }

  hasEffect(playerId, effect) {
    return this.activeEffects(playerId).includes(effect);
  }

  unitRule(playerId, type) {
    return this.civFor(playerId).units[type] || null;
  }

  buildingRule(playerId, type) {
    return this.civFor(playerId).buildings[type] || null;
  }

  effectiveUnitSpec(playerId, type) {
    const base = UNIT_TYPES[type];
    if (!base) throw new RuleError(`Unidad desconocida: ${type}`);

    const spec = { ...base };
    for (const effect of this.activeEffects(playerId)) {
      let m = effect.match(/^unitForce:([^:]+):([+-]?\d+)$/);
      if (m && m[1] === type) spec.force += Number(m[2]);

      m = effect.match(/^unitMove:([^:]+):([+-]?\d+)$/);
      if (m && m[1] === type) spec.move += Number(m[2]);

      m = effect.match(/^carry:([^:]+):(.+)$/);
      if (m && m[1] === type) {
        if (m[2] === 'infinite') spec.carry = Number.MAX_SAFE_INTEGER;
        else if (/^[+-]/.test(m[2])) spec.carry = (spec.carry || 0) + Number(m[2]);
        else spec.carry = Number(m[2]);
      }
    }
    return spec;
  }

  effectiveUnitCost(playerId, type, baseCost) {
    const cost = { ...(baseCost || {}) };
    for (const effect of this.activeEffects(playerId)) {
      const m = effect.match(/^unitCost:([^:]+):([^:]+):([+-]?\d+)$/);
      if (m && m[1] === type) {
        cost[m[2]] = Math.max(0, (cost[m[2]] || 0) + Number(m[3]));
      }
    }
    return cost;
  }

  isCombatParticipant(playerId, unit) {
    const spec = this.effectiveUnitSpec(playerId, unit.type);
    return spec.category === 'military' || spec.category === 'religious' || spec.force > 0;
  }

  ageAllows(player, requiredAge) {
    return AGES.indexOf(player.age) >= AGES.indexOf(requiredAge);
  }

  availableUnits(playerId) {
    const player = this.playerMap.get(playerId);
    const civ = this.civFor(playerId);

    return Object.entries(civ.units)
      .filter(([, rule]) => this.ageAllows(player, rule.age))
      .map(([type, rule]) => {
        const base = this.effectiveUnitSpec(playerId, type);
        const options = [
          { age: rule.age, building: rule.building, cost: rule.cost },
          ...(rule.alternateTraining || [])
        ]
          .filter(o => this.ageAllows(player, o.age))
          .map(o => ({
            ...o,
            cost: this.effectiveUnitCost(playerId, type, o.cost)
          }));

        return {
          type,
          name: base.name,
          category: base.category,
          force: base.force,
          range: base.range,
          move: base.move,
          carry: base.carry || 0,
          provisionalCost: !!rule.provisionalCost,
          training: options
        };
      });
  }

  availableBuildings(playerId) {
    const player = this.playerMap.get(playerId);
    const civ = this.civFor(playerId);

    return Object.entries(civ.buildings)
      .filter(([, rule]) => this.ageAllows(player, rule.age))
      .map(([type, rule]) => ({
        type,
        name: BUILDING_TYPES[type]?.name || type,
        category: BUILDING_TYPES[type]?.category || 'other',
        cost: clone(rule.cost),
        terrains: rule.terrains ? [...rule.terrains] : null,
        maxPerHex: rule.maxPerHex || null
      }));
  }

  availableTechnologies(playerId) {
    const player = this.playerMap.get(playerId);
    const civ = this.civFor(playerId);

    return civ.technologies
      .filter(t => !player.technologies.includes(t.id))
      .filter(t => this.ageAllows(player, t.age))
      .filter(t =>
        !t.building ||
        t.building === 'tc' ||
        t.building === 'other' ||
        this.state.buildings.some(b => b.ownerId === playerId && b.type === t.building)
      )
      .map(t => clone(t));
  }

  civilizationState(playerId) {
    const player = this.playerMap.get(playerId);
    const civ = this.civFor(playerId);

    return {
      id: civ.id,
      name: civ.name,
      age: player.age,
      technologies: [...player.technologies],
      units: this.availableUnits(playerId),
      buildings: this.availableBuildings(playerId),
      availableTechnologies: this.availableTechnologies(playerId)
    };
  }

  assertActive(playerId) {
    if (this.state.winnerId) throw new RuleError('La partida ya terminó.');
    if (this.activePlayer.id !== playerId) throw new RuleError('No es el turno de ese jugador.', 'NOT_ACTIVE_PLAYER');
    if (this.activePlayer.eliminated) throw new RuleError('El jugador está eliminado.');
  }

  assertPhase(phase) {
    if (this.state.phase !== phase) throw new RuleError(`Esta acción requiere la fase ${phase}.`, 'WRONG_PHASE');
    if (this.state.actionUsed) throw new RuleError('La acción de esta fase ya fue utilizada.', 'ACTION_USED');
  }

  log(type, data = {}) {
    this.state.log.push({
      n: this.state.log.length + 1,
      round: this.state.round,
      playerId: this.activePlayer?.id || null,
      phase: this.state.phase,
      type,
      data: clone(data)
    });
  }

  completeAction(type, data = {}) {
    this.state.actionUsed = true;
    this.log(type, data);
    this.checkCompetitiveEnd();
  }

  endPhase() {
    const i = PHASES.indexOf(this.state.phase);

    if (i < PHASES.length - 1) {
      this.state.phase = PHASES[i + 1];
      this.state.actionUsed = false;
      this.log('phase-start', { phase: this.state.phase });
      return;
    }

    this.state.phase = 'economy';
    this.state.actionUsed = false;
    this.advanceActivePlayer();
  }

  pass(playerId) {
    this.assertActive(playerId);
    if (this.state.actionUsed) throw new RuleError('La fase ya tiene una acción.');
    this.completeAction('pass');
  }

  advanceActivePlayer() {
    const alive = this.state.players.filter(p => !p.eliminated);

    if (alive.length === 1) {
      this.state.winnerId = alive[0].id;
      this.log('game-end', { winnerId: alive[0].id });
      return;
    }

    let next = this.state.activePlayerIndex;
    do {
      next = (next + 1) % this.state.players.length;
    } while (this.state.players[next].eliminated);

    if (next <= this.state.activePlayerIndex) this.state.round += 1;
    this.state.activePlayerIndex = next;
    this.state.turnModifiers = {};
    this.applyStartTurnIncome(this.activePlayer.id);
    this.log('turn-start', { playerId: this.activePlayer.id });
  }

  addUnit(ownerId, type, hexId) {
    if (!UNIT_TYPES[type]) throw new RuleError(`Unidad desconocida: ${type}`);
    const u = {
      id: uid('U'),
      ownerId,
      type,
      hexId,
      cargo: [],
      relics: 0,
      embarkedIn: null,
      garrisonedIn: null
    };
    this.state.units.push(u);
    return u;
  }

  addBuilding(ownerId, type, hexId) {
    if (!BUILDING_TYPES[type]) throw new RuleError(`Edificio desconocido: ${type}`);
    const b = { id: uid('B'), ownerId, type, hexId, relics: 0 };
    this.state.buildings.push(b);
    return b;
  }

  addResourceTokens(hexId, resources) {
    const hex = this.hexMap.get(hexId);
    if (!hex) throw new RuleError('Hexágono inexistente.');

    for (const type of RESOURCE_TYPES) {
      for (let i = 0; i < Math.max(0, Number(resources[type] || 0)); i++) {
        hex.looseResources.push({ id: uid('R'), type });
      }
    }
  }

  resourcesAt(hexId) {
    const out = Object.fromEntries(RESOURCE_TYPES.map(r => [r, 0]));
    for (const token of this.hexMap.get(hexId)?.looseResources || []) out[token.type]++;
    return out;
  }

  controllerOf(hexId) {
    const unitOwners = [...new Set(
      this.state.units
        .filter(u => u.hexId === hexId && !u.embarkedIn)
        .map(u => u.ownerId)
    )];
    if (unitOwners.length === 1) return unitOwners[0];
    if (unitOwners.length > 1) return null;

    const buildingOwners = [...new Set(this.state.buildings.filter(b => b.hexId === hexId).map(b => b.ownerId))];
    return buildingOwners.length === 1 ? buildingOwners[0] : null;
  }

  logisticsConnectedHexIds(playerId) {
    const p=this.playerMap.get(playerId);
    if (!p) return [];
    const controlled=new Set(this.controlledHexIds(playerId));
    const reached=new Set([p.tcHexId]);
    const queue=[p.tcHexId];
    for(let i=0;i<queue.length;i++){
      const h=this.hexMap.get(queue[i]);
      if(!h)continue;
      for(const n of physicalNeighbors(this.state.hexes,h.id)){
        if(controlled.has(n.id)&&!reached.has(n.id)){
          reached.add(n.id);queue.push(n.id);
        }
      }
    }
    return [...reached];
  }

  controlledHexIds(playerId) {
    return this.state.hexes
      .filter(h =>
        this.controllerOf(h.id) === playerId ||
        (h.special === 'tc' && h.tcOwnerId === playerId && !this.playerMap.get(playerId).eliminated)
      )
      .map(h => h.id);
  }

  canAffordAt(hexId, cost = {}) {
    const have = this.resourcesAt(hexId);
    return RESOURCE_TYPES.every(r => have[r] >= (cost[r] || 0));
  }

  spendAt(hexId, cost = {}) {
    if (!this.canAffordAt(hexId, cost)) {
      throw new RuleError('No hay suficientes recursos en ese hexágono.', 'INSUFFICIENT_RESOURCES');
    }

    const hex = this.hexMap.get(hexId);
    for (const type of RESOURCE_TYPES) {
      let n = cost[type] || 0;
      hex.looseResources = hex.looseResources.filter(t => {
        if (n > 0 && t.type === type) {
          n--;
          return false;
        }
        return true;
      });
    }
  }

  spendLocalWithCiv(playerId, hexId, cost = {}, { unitType = null } = {}) {
    const hex = this.hexMap.get(hexId);
    if (!hex) throw new RuleError('Hexágono inexistente.');

    const tryPlan = candidate => {
      const local = this.resourcesAt(hexId);
      const remoteFoodSources = [];

      let remoteFoodCap = 0;

      if (this.hasEffect(playerId, 'remoteSpend:animalsFood')) {
        for (const id of this.controlledHexIds(playerId)) {
          if (id === hexId) continue;
          const h = this.hexMap.get(id);
          if (!h || h.source !== 'animals') continue;
          const food = h.looseResources.filter(t => t.type === 'food');
          if (food.length) {
            remoteFoodSources.push({ hex: h, tokens: food, cap: food.length });
            remoteFoodCap += food.length;
          }
        }
      }

      if (unitType === 'elephant') {
        let allowance = 0;
        for (const effect of this.activeEffects(playerId)) {
          const m = effect.match(/^elephantFarmFood:(\d+)$/);
          if (m) allowance = Math.max(allowance, Number(m[1]));
        }
        if (allowance > 0) {
          for (const id of this.controlledHexIds(playerId)) {
            if (id === hexId) continue;
            const h = this.hexMap.get(id);
            const hasOwnFarm = this.state.buildings.some(
              b => b.ownerId === playerId && b.type === 'farm' && b.hexId === id
            );
            if (!h || !hasOwnFarm) continue;
            const food = h.looseResources.filter(t => t.type === 'food');
            const remainingAllowance = Math.max(0, allowance - remoteFoodCap);
            const cap = Math.min(food.length, remainingAllowance);
            if (cap > 0) {
              remoteFoodSources.push({ hex: h, tokens: food, cap });
              remoteFoodCap += cap;
            }
            if (remoteFoodCap >= allowance) break;
          }
        }
      }

      for (const type of RESOURCE_TYPES) {
        if (type === 'food') continue;
        if (local[type] < (candidate[type] || 0)) return null;
      }

      const foodNeed = candidate.food || 0;
      const remoteFoodNeeded = Math.max(0, foodNeed - local.food);
      if (remoteFoodNeeded > remoteFoodCap) return null;

      return { cost: candidate, remoteFoodNeeded, remoteFoodSources };
    };

    let adjusted = clone(cost);
    let plan = tryPlan(adjusted);

    if (!plan && this.hasEffect(playerId, 'stoneSubstitution') && (adjusted.stone || 0) > 0) {
      const alt = clone(adjusted);
      alt.stone = Math.max(0, alt.stone - 1);
      alt.wood = (alt.wood || 0) + 2;
      plan = tryPlan(alt);
      if (plan) adjusted = alt;
    }

    if (!plan) {
      throw new RuleError('No hay suficientes recursos para pagar localmente.', 'INSUFFICIENT_RESOURCES');
    }

    let remainingRemote = plan.remoteFoodNeeded;
    for (const src of plan.remoteFoodSources) {
      if (!remainingRemote) break;
      const take = Math.min(src.cap, remainingRemote);
      const ids = new Set(src.tokens.slice(0, take).map(t => t.id));
      src.hex.looseResources = src.hex.looseResources.filter(t => !ids.has(t.id));
      remainingRemote -= take;
    }

    const localCost = clone(adjusted);
    localCost.food = Math.max(0, (localCost.food || 0) - plan.remoteFoodNeeded);
    this.spendAt(hexId, localCost);

    return {
      paidCost: adjusted,
      remoteFood: plan.remoteFoodNeeded
    };
  }

  trainingCostFor(playerId, unitType, baseCost) {
    const cost = this.effectiveUnitCost(playerId, unitType, baseCost);
    const mod = this.modifiersFor(playerId);
    mod.trainCountByType = mod.trainCountByType || {};
    const typeCount = mod.trainCountByType[unitType] || 0;

    for (const effect of this.activeEffects(playerId)) {
      let m = effect.match(/^firstTrainDiscount:([^:]+):([^:]+):(\d+)$/);
      if (m && m[1] === unitType && typeCount === 0) {
        cost[m[2]] = Math.max(0, (cost[m[2]] || 0) - Number(m[3]));
      }

      m = effect.match(/^firstMilitaryGoldDiscount:(\d+)$/);
      if (
        m &&
        (mod.militaryTrainedThisTurn || 0) === 0 &&
        this.effectiveUnitSpec(playerId, unitType).category === 'military'
      ) {
        cost.gold = Math.max(0, (cost.gold || 0) - Number(m[1]));
      }
    }

    return cost;
  }

  recordTraining(playerId, unitType) {
    const mod = this.modifiersFor(playerId);
    mod.trainCountByType = mod.trainCountByType || {};
    mod.trainCountByType[unitType] = (mod.trainCountByType[unitType] || 0) + 1;
    if (this.effectiveUnitSpec(playerId, unitType).category === 'military') {
      mod.militaryTrainedThisTurn = (mod.militaryTrainedThisTurn || 0) + 1;
    }
  }

  canAffordControlled(playerId, cost = {}) {
    const totals = Object.fromEntries(RESOURCE_TYPES.map(r => [r, 0]));

    for (const id of (this.state.logisticsNetworkEnabled ? this.logisticsConnectedHexIds(playerId) : this.controlledHexIds(playerId))) {
      const x = this.resourcesAt(id);
      for (const r of RESOURCE_TYPES) totals[r] += x[r];
    }

    return RESOURCE_TYPES.every(r => totals[r] >= (cost[r] || 0));
  }

  spendControlled(playerId, cost = {}) {
    if (!this.canAffordControlled(playerId, cost)) {
      throw new RuleError('No hay suficientes recursos en territorios controlados.', 'INSUFFICIENT_RESOURCES');
    }

    const remaining = { ...cost };

    for (const hexId of (this.state.logisticsNetworkEnabled ? this.logisticsConnectedHexIds(playerId) : this.controlledHexIds(playerId))) {
      const hex = this.hexMap.get(hexId);

      for (const type of RESOURCE_TYPES) {
        let need = remaining[type] || 0;
        if (!need) continue;

        hex.looseResources = hex.looseResources.filter(t => {
          if (need > 0 && t.type === type) {
            need--;
            remaining[type]--;
            return false;
          }
          return true;
        });
      }
    }
  }

  transferResourceTokens(fromHexId, toHexId, resources = {}, maxAmount = Infinity) {
    const from = this.hexMap.get(fromHexId);
    const to = this.hexMap.get(toHexId);
    if (!from || !to) throw new RuleError('Hexágono de origen o destino inexistente.');

    const total = RESOURCE_TYPES.reduce(
      (n, r) => n + Math.max(0, Number(resources[r] || 0)),
      0
    );
    if (total < 1 || total > maxAmount) {
      throw new RuleError(`La transferencia admite entre 1 y ${maxAmount} recursos.`);
    }

    const selected = [];
    for (const type of RESOURCE_TYPES) {
      const amount = Math.max(0, Number(resources[type] || 0));
      const tokens = from.looseResources.filter(t => t.type === type).slice(0, amount);
      if (tokens.length !== amount) {
        throw new RuleError('No hay suficientes recursos en el origen.');
      }
      selected.push(...tokens);
    }

    const ids = new Set(selected.map(t => t.id));
    from.looseResources = from.looseResources.filter(t => !ids.has(t.id));
    to.looseResources.push(...selected);
    return total;
  }

  useTradeWagon(playerId, fromHexId, toHexId, resources) {
    this.assertActive(playerId);
    this.assertPhase('economy');

    if (!this.hasEffect(playerId, 'tradeWagon:6')) {
      throw new RuleError('Carreta Mercante no está habilitada.');
    }

    const destinationHasOwnBuilding = this.state.buildings.some(
      b => b.ownerId === playerId && b.hexId === toHexId
    ) || this.playerMap.get(playerId).tcHexId === toHexId;

    if (!destinationHasOwnBuilding) {
      throw new RuleError('Carreta Mercante requiere una construcción propia en destino.');
    }
    if (this.controllerOf(fromHexId) !== playerId && this.playerMap.get(playerId).tcHexId !== fromHexId) {
      throw new RuleError('El origen debe estar controlado.');
    }

    const moved = this.transferResourceTokens(fromHexId, toHexId, resources, 6);
    this.completeAction('trade-wagon', { fromHexId, toHexId, resources: clone(resources), moved });
    return moved;
  }

  dismantleBuilding(playerId, buildingId, recoveredResources = {}) {
    this.assertActive(playerId);
    this.assertPhase('economy');

    if (!this.hasEffect(playerId, 'dismantle:2')) {
      throw new RuleError('Desmantelar no está habilitado.');
    }

    const building = this.state.buildings.find(
      b => b.id === buildingId && b.ownerId === playerId
    );
    if (!building) throw new RuleError('Edificio propio inexistente.');
    if (building.type === 'farm') {
      // Es válido, pero sigue respetando el mismo máximo de recuperación.
    }

    const total = RESOURCE_TYPES.reduce(
      (n, r) => n + Math.max(0, Number(recoveredResources[r] || 0)),
      0
    );
    if (total !== 2) {
      throw new RuleError('Desmantelar recupera exactamente 2 recursos.');
    }

    const rule = this.buildingRule(playerId, building.type);
    const original = rule?.cost || {};

    for (const type of RESOURCE_TYPES) {
      if ((recoveredResources[type] || 0) > (original[type] || 0)) {
        throw new RuleError('No podés recuperar más de un material que el coste original.');
      }
    }

    const hex = this.hexMap.get(building.hexId);
    if (building.type === 'monastery' && building.relics && hex) {
      hex.relics = (hex.relics || 0) + building.relics;
    }

    this.state.buildings = this.state.buildings.filter(b => b.id !== building.id);
    for (const unit of this.state.units) {
      if (unit.garrisonedIn === building.id) unit.garrisonedIn = null;
    }

    this.addResourceTokens(building.hexId, recoveredResources);
    this.completeAction('dismantle', {
      buildingId,
      hexId: building.hexId,
      recoveredResources: clone(recoveredResources)
    });
    return clone(recoveredResources);
  }

  exchangeSurplus(playerId, hexId) {
    this.assertActive(playerId);
    if (!this.hasEffect(playerId, 'exchange:food:gold:1')) {
      throw new RuleError('Excedentes no está habilitado.');
    }
    const hex = this.hexMap.get(hexId);
    if (!hex || this.controllerOf(hexId) !== playerId) {
      throw new RuleError('Excedentes requiere un territorio controlado.');
    }
    this.spendAt(hexId, { food: 1 });
    this.addResourceTokens(hexId, { gold: 1 });
    this.log('surplus-exchange', { playerId, hexId });
    return true;
  }

  useSatrapies(playerId, fromHexId, toHexId, resources) {
    this.assertActive(playerId);
    if (!this.hasEffect(playerId, 'postProductionTransfer:2')) {
      throw new RuleError('Satrapías no está habilitada.');
    }

    const mod = this.modifiersFor(playerId);
    if (!mod.justProduced) {
      throw new RuleError('Satrapías sólo puede usarse inmediatamente después de PRODUCIR.');
    }
    if (mod.satrapiesUsed) throw new RuleError('Satrapías ya fue utilizada este turno.');

    const hasOriginBuilding = this.state.buildings.some(
      b => b.ownerId === playerId && b.hexId === fromHexId
    );
    const hasDestinationBuilding = this.state.buildings.some(
      b => b.ownerId === playerId && b.hexId === toHexId
    );

    if (!hasOriginBuilding || !hasDestinationBuilding) {
      throw new RuleError('Satrapías requiere construcciones propias en origen y destino.');
    }

    const moved = this.transferResourceTokens(fromHexId, toHexId, resources, 2);
    mod.satrapiesUsed = true;
    this.log('satrapies-transfer', { playerId, fromHexId, toHexId, moved });
    return moved;
  }

  moveFarmNorth(playerId, farmId, villagerId, toHexId) {
    this.assertActive(playerId);
    this.assertPhase('economy');

    if (!this.hasEffect(playerId, 'moveFarm')) {
      throw new RuleError('Colonos del Norte no está habilitado.');
    }

    const farm = this.state.buildings.find(
      b => b.id === farmId && b.ownerId === playerId && b.type === 'farm'
    );
    const villager = this.state.units.find(
      u => u.id === villagerId && u.ownerId === playerId && u.type === 'villager'
    );
    const target = this.hexMap.get(toHexId);

    if (!farm || !villager || villager.hexId !== farm.hexId || !target) {
      throw new RuleError('La Granja y el Aldeano deben partir juntos.');
    }
    if (!['plain','desert'].includes(target.terrain)) {
      throw new RuleError('La Granja sólo puede trasladarse a Llanura o Desierto.');
    }
    if (this.state.buildings.filter(b => b.type === 'farm' && b.hexId === toHexId).length >= 2) {
      throw new RuleError('El destino ya tiene el máximo de Granjas.');
    }

    farm.hexId = toHexId;
    villager.hexId = toHexId;
    this.completeAction('move-farm', { farmId, villagerId, toHexId });
    return farm;
  }

  produce(playerId, selections) {
    this.assertActive(playerId);
    this.assertPhase('economy');

    const player = this.playerMap.get(playerId);
    const actionMod = this.modifiersFor(playerId);
    const normalized = (selections || []).map(x =>
      typeof x === 'string' ? { hexId: x, mode: 'source' } : { mode: 'source', ...x }
    );
    const unique = [...new Map(normalized.map(x => [x.hexId, x])).values()];
    const limit = AGE_PRODUCTION_LIMIT[player.age];

    if (!unique.length || unique.length > limit) {
      throw new RuleError(`Podés producir en entre 1 y ${limit} hexágonos.`);
    }

    const results = [];

    for (const sel of unique) {
      const hex = this.hexMap.get(sel.hexId);
      if (!hex) throw new RuleError(`Hexágono inexistente: ${sel.hexId}`);

      const suppressingGalley = this.state.units.find(
        u =>
          u.hexId === hex.id &&
          u.ownerId !== playerId &&
          u.type === 'galley' &&
          this.hasEffect(u.ownerId, 'galleySuppressProduction')
      );
      if (suppressingGalley) {
        throw new RuleError('Dominio Naval enemigo suspende la producción de este hexágono.');
      }

      const villagers = this.state.units.filter(
        u => u.ownerId === playerId && u.hexId === hex.id && u.type === 'villager'
      ).length;

      let type = null;
      let amount = 0;
      let primary = false;

      if (hex.terrain === 'water') {
        const fishingBoats = this.state.units.filter(
          u => u.ownerId === playerId && u.hexId === hex.id && u.type === 'fishingBoat' && !u.embarkedIn
        ).length;
        if (!fishingBoats) throw new RuleError('El Agua requiere al menos un Pesquero para producir.');

        type = 'food';
        let perBoat = 1;
        for (const effect of this.activeEffects(playerId)) {
          const m = effect.match(/^fishingBoatProduction:([+-]?\d+)$/);
          if (m) perBoat += Number(m[1]);
        }
        amount = fishingBoats * perBoat;
      } else if (sel.mode === 'coast') {
        const touchesWater = physicalNeighbors(this.state.hexes, hex.id).some(h => h.terrain === 'water');
        if (!touchesWater || hex.terrain === 'water') {
          throw new RuleError('La pesca costera requiere terreno terrestre adyacente a Agua.');
        }
        type = 'food';
        amount = villagers;
      } else {
        const farms = this.state.buildings.filter(
          b => b.ownerId === playerId && b.hexId === hex.id && b.type === 'farm'
        ).length;

        if (farms) {
          type = 'food';
          const activeFarms = Math.min(farms, villagers);
          amount = activeFarms;

          if (activeFarms > 0 && this.hasEffect(playerId, 'buildingProduction:+1')) {
            amount += activeFarms;
          }

          if (
            amount > 0 &&
            this.hasEffect(playerId, 'farmMountainBonus:+1') &&
            physicalNeighbors(this.state.hexes, hex.id).some(h => h.terrain === 'mountain')
          ) {
            amount += 1;
          }
        } else {
          type = SOURCE_TO_RESOURCE[hex.source];
          primary = !!type;

          if (!type) throw new RuleError(`El hexágono ${hex.id} no tiene una fuente productiva.`);

          amount = villagers;

          for (const effect of this.activeEffects(playerId)) {
            const m = effect.match(/^production:([^:]+):([+-]?\d+)$/);
            if (m && m[1] === hex.source) {
              amount += villagers * Number(m[2]);
            }
          }

          let productiveBuilding = false;

          if (
            ['animals', 'berries'].includes(hex.source) &&
            this.state.buildings.some(b => b.ownerId === playerId && b.hexId === hex.id && b.type === 'mill')
          ) {
            amount += 1;
            productiveBuilding = true;
          }

          if (
            ['forest', 'gold', 'stone'].includes(hex.source) &&
            this.state.buildings.some(b => b.ownerId === playerId && b.hexId === hex.id && b.type === 'camp')
          ) {
            amount += 1;
            productiveBuilding = true;
          }

          if (productiveBuilding && this.hasEffect(playerId, 'buildingProduction:+1')) {
            amount += 1;
          }
        }
      }

      if (
        actionMod.extraProductionUnitId &&
        this.state.units.some(
          u =>
            u.id === actionMod.extraProductionUnitId &&
            u.ownerId === playerId &&
            u.type === 'villager' &&
            u.hexId === hex.id
        )
      ) {
        amount += 1;
      }

      if (actionMod.productionHexBonus?.[hex.id]) {
        amount += actionMod.productionHexBonus[hex.id];
      }

      if (amount <= 0) throw new RuleError(`No hay productores elegibles en ${hex.id}.`);

      this.addResourceTokens(hex.id, { [type]: amount });
      const result = { hexId: hex.id, resourceType: type, amount, mode: sel.mode };

      if (
        sel.sendToTC &&
        ['gold','stone'].includes(type) &&
        this.hasEffect(playerId, 'tributeProduction:1')
      ) {
        const token = hex.looseResources.find(r => r.type === type);
        const tc = this.hexMap.get(player.tcHexId);
        if (token && tc) {
          hex.looseResources = hex.looseResources.filter(r => r.id !== token.id);
          tc.looseResources.push(token);
          result.sentToTC = 1;
        }
      }

      if (amount > 1) {
        const neighbors = physicalNeighbors(this.state.hexes, hex.id);
        for (const rival of this.state.players) {
          if (
            rival.id === playerId ||
            rival.eliminated ||
            !this.hasEffect(rival.id, 'productionRaid:1')
          ) continue;

          const raider = this.state.units.find(
            u =>
              u.ownerId === rival.id &&
              u.type === 'villager' &&
              neighbors.some(n => n.id === u.hexId)
          );
          if (!raider) continue;

          const token = hex.looseResources.find(r => r.type === type);
          const raidHex = this.hexMap.get(raider.hexId);
          if (token && raidHex) {
            hex.looseResources = hex.looseResources.filter(r => r.id !== token.id);
            raidHex.looseResources.push(token);
            result.raidedBy = rival.id;
            result.raidedAmount = 1;
          }
          break;
        }
      }

      results.push(result);

      if (primary) {
        const hist = hex.productionHistory[playerId] || { lastRound: null };
        const exhaust = hist.lastRound === this.state.round - 1;
        hex.productionHistory[playerId] = { lastRound: this.state.round };

        if (
          exhaust &&
          EXHAUSTED_TO[hex.source] &&
          !this.hasEffect(playerId, `noExhaustion:${hex.source}`)
        ) {
          const oldSource = hex.source;
          const change = EXHAUSTED_TO[oldSource];
          hex.terrain = change.terrain;
          hex.source = change.source;
          if (hex.terrain === 'water' && !hex.waterLane) hex.waterLane = 'A';
          results[results.length - 1].exhausted = oldSource;
        }
      }
    }

    delete actionMod.extraProductionUnitId;
    delete actionMod.productionHexBonus;
    actionMod.justProduced = true;
    this.completeAction('produce', { results });
    return results;
  }

  edgeBlocked(a, b) {
    const ha = this.hexMap.get(a);
    const hb = this.hexMap.get(b);
    return !!(ha?.palisades?.includes(b) || hb?.palisades?.includes(a));
  }

  moveUnits(playerId, unitIds, toHexId) {
    this.assertActive(playerId);

    if (!['economy', 'military'].includes(this.state.phase) || this.state.actionUsed) {
      throw new RuleError('Mover no está disponible ahora.');
    }

    if (!unitIds?.length) throw new RuleError('Seleccioná al menos una unidad.');

    const units = unitIds.map(id => this.state.units.find(u => u.id === id));

    if (units.some(u => !u || u.ownerId !== playerId || u.embarkedIn || u.garrisonedIn)) {
      throw new RuleError('Hay una unidad inválida, enemiga, embarcada o guarecida.');
    }

    const origins = [...new Set(units.map(u => u.hexId))];
    const originHexId = origins[0];

    if (origins.length !== 1) {
      throw new RuleError('Las unidades que se mueven juntas deben partir del mismo hexágono.');
    }

    if (
      this.state.phase === 'economy' &&
      units.some(u => this.effectiveUnitSpec(playerId, u.type).category !== 'economic')
    ) {
      throw new RuleError('Economía sólo mueve unidades económicas.');
    }

    const target = this.hexMap.get(toHexId);
    if (!target) throw new RuleError('Destino inexistente.');

    const origin = this.hexMap.get(originHexId);
    if (
      origin &&
      hexDistance(origin, target) === 1 &&
      this.edgeBlocked(originHexId, toHexId)
    ) {
      if (units.length < 2) {
        throw new RuleError('Una empalizada bloquea el paso. Se necesitan al menos 2 unidades para destruirla.');
      }

      origin.palisades = (origin.palisades || []).filter(id => id !== toHexId);
      target.palisades = (target.palisades || []).filter(id => id !== originHexId);
      this.completeAction('break-palisade', {
        unitIds,
        fromHexId: originHexId,
        protectedHexId: toHexId
      });
      return { palisadeDestroyed: true, moved: false };
    }

    const escorts = units
      .map(u => ({ unit: u, spec: this.effectiveUnitSpec(playerId, u.type) }))
      .filter(x => !x.spec.tags?.includes('siege'));

    const escortMove = escorts.length
      ? Math.min(...escorts.map(x => x.spec.move))
      : 0;

    for (const unit of units) {
      const spec = this.effectiveUnitSpec(playerId, unit.type);
      const transportedSiege = spec.tags?.includes('siege');
      const forcedMarch = this.modifiersFor(playerId).forcedMarchUnitId === unit.id ? 1 : 0;

      let unitMove = spec.move + forcedMarch;

      if (
        unit.type === 'villager' &&
        this.hasEffect(playerId, 'roadMovement:villager:2')
      ) {
        const hasOriginBuilding = this.state.buildings.some(
          b => b.ownerId === playerId && b.hexId === unit.hexId
        );
        const hasDestinationBuilding = this.state.buildings.some(
          b => b.ownerId === playerId && b.hexId === toHexId
        );
        if (hasOriginBuilding && hasDestinationBuilding) unitMove = Math.max(unitMove, 2);
      }

      if (
        spec.tags?.includes('ship') &&
        this.hasEffect(playerId, 'navalNetworkMovement')
      ) {
        unitMove = Math.max(unitMove, 99);
      }

      const allowedMove = transportedSiege ? escortMove : unitMove;

      if (transportedSiege && !escorts.length) {
        throw new RuleError(`${spec.name} necesita otra unidad para ser transportado.`);
      }

      const path = shortestMovementPath(this.state.hexes, unit.hexId, toHexId, {
        water: !!spec.water,
        blockedEdge: (a, b) => this.edgeBlocked(a, b)
      });

      if (!path || path.length - 1 > allowedMove) {
        throw new RuleError(`${spec.name} no puede llegar al destino.`);
      }

      if (path.length > 2) {
        for (const intermediateId of path.slice(1, -1)) {
          const intermediate = this.hexMap.get(intermediateId);
          const stoppedByTower = this.state.buildings.some(tower => {
            if (tower.type !== 'tower' || tower.ownerId === playerId) return false;
            if (!this.hasEffect(tower.ownerId, 'towerZoneControl')) return false;
            const towerHex = this.hexMap.get(tower.hexId);
            return towerHex && intermediate && hexDistance(towerHex, intermediate) <= 1;
          });

          if (stoppedByTower) {
            throw new RuleError('Zona de Control obliga a terminar el movimiento al entrar junto a una Torre enemiga.');
          }
        }
      }
    }

    const enemyMilitary = this.state.units.filter(
      u =>
        u.hexId === toHexId &&
        !u.embarkedIn &&
        u.ownerId !== playerId &&
        this.isCombatParticipant(u.ownerId, u)
    );

    if (enemyMilitary.length) {
      throw new RuleError('El destino tiene defensa militar: usá attack().', 'COMBAT_REQUIRED');
    }

    const movingMilitary = units.some(
      u => this.effectiveUnitSpec(playerId, u.type).category === 'military'
    );

    const movingReligious = units.filter(
      u => this.effectiveUnitSpec(playerId, u.type).category === 'religious'
    );
    const enemyReligious = this.state.units.filter(
      u =>
        u.hexId === toHexId &&
        !u.embarkedIn &&
        u.ownerId !== playerId &&
        this.effectiveUnitSpec(u.ownerId, u.type).category === 'religious'
    );

    if (movingMilitary) this.occupyUndefended(playerId, toHexId);

    units.forEach(u => {
      u.hexId = toHexId;
      if (['transportShip','galley'].includes(u.type)) {
        this.state.units
          .filter(p => p.embarkedIn === u.id)
          .forEach(p => { p.hexId = toHexId; });
      }
    });

    if (movingReligious.length && enemyReligious.length) {
      const returned = [];
      for (const u of [...movingReligious, ...enemyReligious]) {
        const current = this.state.units.find(x => x.id === u.id);
        if (!current) continue;
        this.dropUnitRelics(current, toHexId);
        current.hexId = this.playerMap.get(current.ownerId).tcHexId;
        current.garrisonedIn = null;
        returned.push(current.id);
      }
      this.log('religious-encounter', { hexId: toHexId, unitIds: returned });
    } else {
      this.resolveReligiousEncounterAtHex(toHexId);
    }

    const originHex = this.hexMap.get(originHexId);
    if (
      originHex &&
      originHex.terrain === 'mountain' &&
      target.terrain !== 'mountain' &&
      !originHex.explored
    ) {
      this.exploreMountain(playerId, originHexId);
    }

    delete this.modifiersFor(playerId).forcedMarchUnitId;
    this.completeAction('move', { unitIds, toHexId });
  }

  occupyUndefended(attackerId, hexId) {
    const displaced = this.state.units.filter(
      u =>
        u.hexId === hexId &&
        u.ownerId !== attackerId &&
        UNIT_TYPES[u.type].category !== 'military'
    );

    for (const u of displaced) {
      if (this.effectiveUnitSpec(u.ownerId, u.type).category === 'religious') {
        this.dropUnitRelics(u, hexId);
      }
      u.hexId = this.playerMap.get(u.ownerId).tcHexId;
    }

    const enemyBuildings = this.state.buildings.filter(
      b => b.hexId === hexId && b.ownerId !== attackerId
    );

    const capturedFarms = [];
    if (this.hasEffect(attackerId, 'captureFarms')) {
      for (const farm of enemyBuildings.filter(b => b.type === 'farm')) {
        farm.ownerId = attackerId;
        capturedFarms.push(farm.id);
      }
    }

    const destroyed = enemyBuildings.filter(b => !capturedFarms.includes(b.id));
    const destroyedIds = new Set(destroyed.map(b => b.id));
    const occupiedHex = this.hexMap.get(hexId);
    for (const building of destroyed) {
      if (building.type === 'monastery' && (building.relics || 0) > 0 && occupiedHex) {
        occupiedHex.relics = (occupiedHex.relics || 0) + building.relics;
        building.relics = 0;
      }
    }
    this.state.buildings = this.state.buildings.filter(b => !destroyedIds.has(b.id));
    for (const unit of this.state.units) {
      if (unit.garrisonedIn && destroyedIds.has(unit.garrisonedIn)) {
        unit.garrisonedIn = null;
      }
    }

    const hex = this.hexMap.get(hexId);

    if (capturedFarms.length) {
      this.log('capture-farms', { attackerId, hexId, farmIds: capturedFarms });
    }

    if (hex.special === 'tc' && hex.tcOwnerId && hex.tcOwnerId !== attackerId) {
      this.eliminatePlayer(hex.tcOwnerId, attackerId);
    }
  }

  garrisonUnit(playerId, unitId, towerId) {
    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    const tower = this.state.buildings.find(
      b => b.id === towerId && b.ownerId === playerId && b.type === 'tower'
    );

    if (!unit || !tower) throw new RuleError('Unidad o Torre inválida.');
    if (!this.hasEffect(playerId, 'garrison:ranged')) {
      throw new RuleError('La civilización no tiene Guarnición habilitada.');
    }

    const spec = this.effectiveUnitSpec(playerId, unit.type);
    if (!spec.tags?.includes('ranged')) {
      throw new RuleError('Sólo unidades de arquería pueden guarecerse con esta habilidad.');
    }
    if (unit.hexId !== tower.hexId || unit.embarkedIn) {
      throw new RuleError('La unidad debe estar en el mismo hexágono que la Torre.');
    }

    unit.garrisonedIn = tower.id;
    this.log('garrison', { playerId, unitId, towerId });
    return unit;
  }

  ungarrisonUnit(playerId, unitId) {
    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    if (!unit) throw new RuleError('Unidad inválida.');
    const oldTowerId = unit.garrisonedIn;
    unit.garrisonedIn = null;
    this.log('ungarrison', { playerId, unitId, towerId: oldTowerId });
    return unit;
  }

  transportCapacity(playerId, ship) {
    if (!ship) return 0;
    if (ship.type === 'transportShip') return 6;
    if (ship.type === 'galley' && this.hasEffect(playerId, 'galleyTransport:6')) return 6;
    return 0;
  }

  embarkUnits(playerId, shipId, unitIds) {
    const ship = this.state.units.find(
      u => u.id === shipId && u.ownerId === playerId && ['transportShip','galley'].includes(u.type)
    );
    if (!ship) throw new RuleError('Barco de transporte inválido.');

    const capacity = this.transportCapacity(playerId, ship);
    if (!capacity) throw new RuleError('Ese barco no puede transportar unidades.');

    const shipHex = this.hexMap.get(ship.hexId);
    if (!shipHex || shipHex.terrain !== 'water') {
      throw new RuleError('El barco debe estar en Agua.');
    }

    const passengers = this.state.units.filter(u => u.embarkedIn === ship.id);
    const units = (unitIds || []).map(id => this.state.units.find(u => u.id === id));

    if (!units.length || units.some(u => !u || u.ownerId !== playerId || u.id === ship.id)) {
      throw new RuleError('Pasajeros inválidos.');
    }
    if (passengers.length + units.length > capacity) {
      throw new RuleError('Se supera la capacidad del barco.');
    }

    for (const unit of units) {
      const source = this.hexMap.get(unit.hexId);
      if (
        unit.embarkedIn ||
        unit.garrisonedIn ||
        !source ||
        source.terrain === 'water' ||
        hexDistance(source, shipHex) !== 1
      ) {
        throw new RuleError('Cada pasajero debe estar en tierra adyacente al barco.');
      }
    }

    for (const unit of units) {
      unit.embarkedIn = ship.id;
      unit.hexId = ship.hexId;
    }

    this.log('embark', { playerId, shipId, unitIds: units.map(u => u.id) });
    return units;
  }

  disembarkUnits(playerId, shipId, unitIds, landHexId) {
    const ship = this.state.units.find(u => u.id === shipId && u.ownerId === playerId);
    const land = this.hexMap.get(landHexId);

    if (!ship || !land || land.terrain === 'water') {
      throw new RuleError('Barco o destino de desembarco inválido.');
    }

    const shipHex = this.hexMap.get(ship.hexId);
    if (!shipHex || hexDistance(shipHex, land) !== 1) {
      throw new RuleError('El desembarco debe hacerse en tierra adyacente.');
    }

    const ids = new Set(unitIds || []);
    const units = this.state.units.filter(
      u => u.ownerId === playerId && u.embarkedIn === shipId && ids.has(u.id)
    );

    if (!units.length || units.length !== ids.size) {
      throw new RuleError('Pasajeros de desembarco inválidos.');
    }

    for (const unit of units) {
      unit.embarkedIn = null;
      unit.hexId = landHexId;
    }

    this.resolveReligiousEncounterAtHex(landHexId);
    this.log('disembark', { playerId, shipId, unitIds: units.map(u => u.id), landHexId });
    return units;
  }

  resolveReligiousEncounterAtHex(hexId) {
    const religious = this.state.units.filter(
      u =>
        u.hexId === hexId &&
        !u.embarkedIn &&
        this.effectiveUnitSpec(u.ownerId, u.type).category === 'religious'
    );
    const owners = [...new Set(religious.map(u => u.ownerId))];
    if (owners.length < 2) return [];

    const returned = [];
    for (const unit of religious) {
      this.dropUnitRelics(unit, hexId);
      unit.garrisonedIn = null;
      unit.hexId = this.playerMap.get(unit.ownerId).tcHexId;
      returned.push(unit.id);
    }

    this.log('religious-encounter', { hexId, unitIds: returned });
    return returned;
  }

  loadResource(playerId, unitId, resourceType, amount = 1) {
    this.assertActive(playerId);

    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    if (!unit) throw new RuleError('Unidad inválida.');

    const spec = this.effectiveUnitSpec(playerId, unit.type);
    if (!spec.carry) throw new RuleError('Esa unidad no transporta recursos.');
    if (unit.cargo.length + amount > spec.carry) throw new RuleError('Supera la capacidad de carga.');

    const hex = this.hexMap.get(unit.hexId);
    const available = hex.looseResources.filter(r => r.type === resourceType);

    if (available.length < amount) {
      throw new RuleError('No hay suficientes recursos para cargar.');
    }

    const ids = new Set(available.slice(0, amount).map(r => r.id));

    hex.looseResources = hex.looseResources.filter(r => {
      if (ids.has(r.id)) {
        unit.cargo.push(r);
        return false;
      }
      return true;
    });
  }

  unloadAll(playerId, unitId) {
    this.assertActive(playerId);

    const u = this.state.units.find(x => x.id === unitId && x.ownerId === playerId);
    if (!u) throw new RuleError('Unidad inválida.');

    this.hexMap.get(u.hexId).looseResources.push(...u.cargo);
    u.cargo = [];
  }

  build(playerId, buildingType, hexId, villagerId) {
    this.assertActive(playerId);

    const base = BUILDING_TYPES[buildingType];
    const rule = this.buildingRule(playerId, buildingType);
    const player = this.playerMap.get(playerId);

    if (!base || !rule) {
      throw new RuleError('Ese edificio no está disponible para esta civilización.', 'BUILDING_UNAVAILABLE');
    }

    if (!this.ageAllows(player, rule.age)) {
      throw new RuleError('La Edad actual no permite construir ese edificio.');
    }

    this.assertPhase(base.category === 'military' ? 'military' : 'economy');

    const hex = this.hexMap.get(hexId);
    const villager = this.state.units.find(
      u => u.id === villagerId && u.ownerId === playerId && u.type === 'villager'
    );

    if (!hex || !villager) {
      throw new RuleError('Se requiere un Aldeano propio.');
    }

    let paymentHexId = hexId;

    if (buildingType === 'port') {
      const builderHex = this.hexMap.get(villager.hexId);
      if (
        hex.terrain !== 'water' ||
        !builderHex ||
        builderHex.terrain === 'water' ||
        hexDistance(builderHex, hex) !== 1
      ) {
        throw new RuleError('El Puerto se construye en Agua adyacente al Aldeano.');
      }
      paymentHexId = builderHex.id;
    } else {
      if (villager.hexId !== hexId) {
        throw new RuleError('El Aldeano debe estar en el hexágono donde construye.');
      }
      if (hex.terrain === 'water') {
        throw new RuleError('No se puede construir ahí.');
      }
    }

    // Dos Granjas ocupan las dos mitades disponibles de la casilla.
    // Una única Granja deja espacio para otro edificio permitido por el terreno.
    const farmCountHere = this.state.buildings.filter(
      b => b.hexId === hexId && b.type === 'farm'
    ).length;
    if (buildingType !== 'farm' && farmCountHere >= 2) {
      throw new RuleError(
        'Dos Granjas ocupan el hexágono completo; no se puede construir otro edificio.',
        'BUILD_HEX_FULL'
      );
    }

    // Restricciones de terreno del reglamento. Se validan antes de gastar recursos.
    if (buildingType === 'mill' && !['animals', 'berries'].includes(hex.source)) {
      throw new RuleError('El Molino requiere un recurso de comida (animales o frutos).', 'INVALID_BUILD_TERRAIN');
    }
    if (buildingType === 'camp' && !['forest', 'gold', 'stone'].includes(hex.source)) {
      throw new RuleError('El Campamento de Recursos requiere bosque, oro o piedra.', 'INVALID_BUILD_TERRAIN');
    }
    if (['barracks', 'tower', 'monastery', 'market', 'siege', 'castle'].includes(buildingType) &&
        (!['plain', 'desert'].includes(hex.terrain) || hex.source)) {
      throw new RuleError('Este edificio sólo se construye en Llanura o Desierto libre de recursos.', 'INVALID_BUILD_TERRAIN');
    }

    if (
      !base.multiple &&
      this.state.buildings.some(b => b.ownerId === playerId && b.type === buildingType)
    ) {
      throw new RuleError('En general sólo puede haber un edificio de cada tipo.');
    }

    if (buildingType === 'farm') {
      const allowed = new Set(rule.terrains || ['plain']);
      if (this.hasEffect(playerId, 'farmTerrain:desert')) allowed.add('desert');

      if (!allowed.has(hex.terrain)) {
        throw new RuleError('La civilización no puede construir una Granja en ese terreno.');
      }

      const max = rule.maxPerHex || 2;
      if (this.state.buildings.filter(b => b.hexId === hexId && b.type === 'farm').length >= max) {
        throw new RuleError(`Máximo ${max} Granjas por hexágono.`);
      }
    }

    const buildCost = clone(rule.cost);
    const buildMod = this.modifiersFor(playerId);
    if (buildMod.buildWoodDiscount) {
      buildCost.wood = Math.max(0, (buildCost.wood || 0) - buildMod.buildWoodDiscount);
      delete buildMod.buildWoodDiscount;
    }

    const buildPayment = this.spendLocalWithCiv(playerId, paymentHexId, buildCost);
    const building = this.addBuilding(playerId, buildingType, hexId);
    if (!player.stats.buildingsConstructed.includes(buildingType)) {
      player.stats.buildingsConstructed.push(buildingType);
    }
    this.completeAction('build', {
      buildingId: building.id,
      buildingType,
      hexId,
      paidCost: clone(buildPayment.paidCost)
    });
    return building;
  }

  trainUnits(playerId, requests) {
    this.assertActive(playerId);

    if (!Array.isArray(requests) || !requests.length) {
      throw new RuleError('No hay unidades para entrenar.');
    }

    const player = this.playerMap.get(playerId);
    const items = requests.map(r => {
      const base = UNIT_TYPES[r.type];
      const rule = this.unitRule(playerId, r.type);
      if (!base || !rule) {
        throw new RuleError(`Unidad no disponible para ${this.civFor(playerId).name}: ${r.type}`, 'UNIT_UNAVAILABLE');
      }
      return { r, base, rule };
    });

    const actionCategory = items[0].base.category === 'economic' ? 'economy' : 'military';

    if (items.some(x => (x.base.category === 'economic' ? 'economy' : 'military') !== actionCategory)) {
      throw new RuleError('No se mezclan unidades económicas con militares/religiosas en una misma acción.');
    }

    this.assertPhase(actionCategory);

    const created = [];
    const trainingLog = [];

    for (const { r, base, rule } of items) {
      if (!this.ageAllows(player, rule.age)) {
        throw new RuleError(`${base.name} todavía no está disponible en esta Edad.`);
      }

      const options = [
        { age: rule.age, building: rule.building, cost: rule.cost },
        ...(rule.alternateTraining || [])
      ];

      for (const effect of this.activeEffects(playerId)) {
        if (
          effect === 'alternateTraining:cavalry:castle' &&
          this.effectiveUnitSpec(playerId, r.type).tags?.includes('cavalry')
        ) {
          options.push({ age: 'castles', building: 'castle', cost: rule.cost });
        }
      }

      const availableOptions = options.filter(o => this.ageAllows(player, o.age));

      let option = null;
      let spawnHexId = null;
      let building = null;

      if (!r.buildingId) {
        option = availableOptions.find(o => o.building === 'tc');
        if (option) spawnHexId = player.tcHexId;
      } else {
        building = this.state.buildings.find(
          b => b.id === r.buildingId && b.ownerId === playerId
        );

        if (!building) throw new RuleError('Edificio de entrenamiento inválido.');

        option = availableOptions.find(o => o.building === building.type);

        if (
          !option &&
          this.hasEffect(playerId, 'castleTrainingAdjacent:cavalry') &&
          this.effectiveUnitSpec(playerId, r.type).tags?.includes('cavalry')
        ) {
          const castle = this.state.buildings.find(
            b =>
              b.ownerId === playerId &&
              b.type === 'castle' &&
              hexDistance(this.hexMap.get(b.hexId), this.hexMap.get(building.hexId)) <= 1
          );
          if (castle) option = { age: 'imperial', building: building.type, cost: rule.cost };
        }

        if (option) spawnHexId = building.hexId;
      }

      if (!option || !spawnHexId) {
        throw new RuleError(`No hay un punto válido para entrenar ${base.name}.`);
      }

      const cost = this.trainingCostFor(playerId, r.type, option.cost);
      let paidCost = clone(cost);

      if (r.type === 'villager') {
        this.spendControlled(playerId, cost);
        player.stats.villagersTrained++;
      } else {
        const payment = this.spendLocalWithCiv(
          playerId,
          spawnHexId,
          cost,
          { unitType: r.type }
        );
        paidCost = clone(payment.paidCost);
        if (base.category === 'military') player.stats.militaryTrained++;
      }

      let finalSpawnHexId = spawnHexId;

      const chooseAdjacent = desiredId => {
        if (!desiredId) return null;
        const h = this.hexMap.get(desiredId);
        const origin = this.hexMap.get(spawnHexId);
        if (!h || !origin || hexDistance(origin, h) !== 1) {
          throw new RuleError('El hexágono de aparición alternativo debe ser adyacente.');
        }
        return h.id;
      };

      if (
        r.spawnHexId &&
        r.type === 'villager' &&
        this.hasEffect(playerId, 'spawnAdjacent:villager')
      ) {
        finalSpawnHexId = chooseAdjacent(r.spawnHexId);
      } else if (
        r.spawnHexId &&
        this.effectiveUnitSpec(playerId, r.type).tags?.includes('ranged') &&
        this.hasEffect(playerId, 'spawnAdjacent:ranged')
      ) {
        finalSpawnHexId = chooseAdjacent(r.spawnHexId);
      } else if (
        r.spawnHexId &&
        this.effectiveUnitSpec(playerId, r.type).tags?.includes('ship') &&
        this.hasEffect(playerId, 'spawnAdjacent:ships')
      ) {
        finalSpawnHexId = chooseAdjacent(r.spawnHexId);
        if (this.hexMap.get(finalSpawnHexId).terrain !== 'water') {
          throw new RuleError('Astillero sólo permite aparecer en Agua adyacente.');
        }
      } else if (
        r.spawnHexId &&
        r.type === 'scorpion' &&
        this.hasEffect(playerId, 'spawnAdjacent:scorpion')
      ) {
        finalSpawnHexId = chooseAdjacent(r.spawnHexId);
      } else if (
        r.spawnHexId &&
        this.effectiveUnitSpec(playerId, r.type).tags?.includes('cavalry') &&
        this.hasEffect(playerId, 'spawnMilitaryBuilding:cavalry')
      ) {
        const destination = this.state.buildings.find(
          b =>
            b.ownerId === playerId &&
            b.hexId === r.spawnHexId &&
            BUILDING_TYPES[b.type]?.category === 'military'
        );
        if (!destination) {
          throw new RuleError('Movilización requiere una construcción militar propia.');
        }
        finalSpawnHexId = r.spawnHexId;
      }

      const createdUnit = this.addUnit(playerId, r.type, finalSpawnHexId);
      created.push(createdUnit);
      trainingLog.push({
        id:createdUnit.id,
        type:createdUnit.type,
        hexId:createdUnit.hexId,
        paidCost
      });
      this.recordTraining(playerId, r.type);
    }

    this.completeAction('train', { units: trainingLog });

    return created;
  }

  research(playerId, technology) {
    this.assertActive(playerId);
    this.assertPhase('technology');

    const player = this.playerMap.get(playerId);
    const id = typeof technology === 'string' ? technology : technology?.id;

    if (!id) throw new RuleError('Tecnología sin id.');
    if (player.technologies.includes(id)) throw new RuleError('Tecnología ya investigada.');

    const rule = this.technologyRule(playerId, id);
    if (!rule) {
      throw new RuleError('Tecnología no disponible para esta civilización.', 'TECH_UNAVAILABLE');
    }

    if (!this.ageAllows(player, rule.age)) {
      throw new RuleError('La tecnología aún no está disponible.');
    }

    if (
      rule.building &&
      rule.building !== 'tc' &&
      rule.building !== 'other' &&
      !this.state.buildings.some(b => b.ownerId === playerId && b.type === rule.building)
    ) {
      throw new RuleError(`Se requiere ${BUILDING_TYPES[rule.building]?.name || rule.building} para investigar esta tecnología.`);
    }

    const techCost = clone(rule.cost);
    const techMod = this.modifiersFor(playerId);
    if (techMod.nextTechDiscount) {
      const { resourceType, amount } = techMod.nextTechDiscount;
      techCost[resourceType] = Math.max(0, (techCost[resourceType] || 0) - amount);
      delete techMod.nextTechDiscount;
    }

    this.spendControlled(playerId, techCost);
    player.technologies.push(id);
    this.completeAction('research', {
      id,
      name: rule.name,
      effects: rule.effects,
      paidCost: clone(techCost)
    });
    return rule;
  }

  advanceAge(playerId) {
    this.assertActive(playerId);
    this.assertPhase('technology');

    const p = this.playerMap.get(playerId);
    const i = AGES.indexOf(p.age);

    if (i >= AGES.length - 1) throw new RuleError('Ya está en Edad Imperial.');

    const next = AGES[i + 1];
    const ageCost = clone(AGE_COSTS[next]);
    this.spendControlled(playerId, ageCost);
    p.age = next;
    this.completeAction('advance-age', {
      age: next,
      paidCost: ageCost
    });
  }

  modifyTerrain(playerId, action, hexId, extra = {}) {
    this.assertActive(playerId);
    this.assertPhase('technology');

    const hex = this.hexMap.get(hexId);

    const villager = this.state.units.some(
      u => u.ownerId === playerId && u.type === 'villager' && u.hexId === hexId
    );

    if (!hex || !villager) {
      throw new RuleError('Modificar terreno requiere un Aldeano propio en el terreno.');
    }

    if (action === 'irrigate') {
      if (
        hex.terrain !== 'desert' ||
        !physicalNeighbors(this.state.hexes, hexId).some(
          h => ['mountain', 'water'].includes(h.terrain)
        )
      ) {
        throw new RuleError('Irrigar requiere Desierto adyacente a Montaña o Agua.');
      }

      this.spendControlled(playerId, { wood: 3, food: 3, stone: 3 });
      hex.terrain = 'plain';
    } else if (action === 'drain') {
      const water = this.hexMap.get(extra.waterHexId);

      if (
        hex.terrain !== 'desert' ||
        !water ||
        water.terrain !== 'water' ||
        hexDistance(hex, water) !== 1
      ) {
        throw new RuleError('Drenar requiere Agua adyacente al Desierto del Aldeano.');
      }

      this.spendControlled(playerId, { wood: 5, food: 5, stone: 5 });
      water.terrain = 'desert';
      water.waterLane = null;
      hex.terrain = 'plain';
    } else if (action === 'fortify') {
      const neighbor = this.hexMap.get(extra.neighborHexId);

      if (!neighbor || hexDistance(hex, neighbor) !== 1) {
        throw new RuleError('Elegí un lado adyacente válido.');
      }

      if (
        this.hasEffect(playerId, 'fortifyAlternative:stone:2') &&
        !this.canAffordControlled(playerId, { wood: 3 }) &&
        this.canAffordControlled(playerId, { stone: 2 })
      ) {
        this.spendControlled(playerId, { stone: 2 });
      } else {
        this.spendControlled(playerId, { wood: 3 });
      }

      if (!hex.palisades.includes(neighbor.id)) {
        hex.palisades.push(neighbor.id);
      }
    } else {
      throw new RuleError('Modificación de terreno desconocida.');
    }

    this.completeAction('modify-terrain', { action, hexId, ...extra });
  }

  instruct(playerId) {
    this.assertActive(playerId);
    this.assertPhase('military');

    const p = this.playerMap.get(playerId);

    if (p.militaryPower >= MAX_MILITARY_POWER) {
      throw new RuleError('Poder de Pelea ya está en 16.');
    }

    const wonder = this.state.hexes.find(h => h.special === 'wonder');
    const controlsWonder = wonder && this.controllerOf(wonder.id) === playerId;

    const instructCost = controlsWonder ? {} : { gold: 1 };
    if (!controlsWonder) {
      this.spendControlled(playerId, instructCost);
    }
    p.militaryPower++;
    if (p.militaryPower >= MAX_MILITARY_POWER) {
      p.stats.reached16MilitaryPower = true;
    }
    this.completeAction('instruct', {
      militaryPower: p.militaryPower,
      paidCost: clone(instructCost)
    });
  }

  trade(playerId, partnerId, { give, receive } = {}) {
    this.assertActive(playerId);
    this.assertPhase('economy');

    const partner = this.playerMap.get(partnerId);
    if (!partner || partner.eliminated || partnerId === playerId) {
      throw new RuleError('Socio comercial inválido.');
    }

    const marketExists = this.state.buildings.some(b => b.type === 'market');
    if (!marketExists) throw new RuleError('Debe existir al menos un Mercado construido.');

    if (!give || !receive) throw new RuleError('El comercio requiere ambos lados del intercambio.');

    const giveGold = Number(give.resources?.gold || 0);
    const receiveGold = Number(receive.resources?.gold || 0);
    if (giveGold + receiveGold < 1) {
      throw new RuleError('Todo comercio debe incluir Oro como pago.');
    }

    const validateSide = (ownerId, recipientId, side) => {
      const owner = this.playerMap.get(ownerId);
      const recipient = this.playerMap.get(recipientId);
      if (!owner || !recipient) throw new RuleError('Jugador de comercio inexistente.');

      const sourceControlled =
        this.controllerOf(side.fromHexId) === ownerId ||
        owner.tcHexId === side.fromHexId;

      const destinationControlled =
        this.controllerOf(side.toHexId) === recipientId ||
        recipient.tcHexId === side.toHexId;

      if (!sourceControlled || !destinationControlled) {
        throw new RuleError('Origen y destino del comercio deben estar controlados por sus respectivos jugadores.');
      }
    };

    validateSide(playerId, partnerId, give);
    validateSide(partnerId, playerId, receive);

    const giveTotal = RESOURCE_TYPES.reduce((n,r)=>n+Number(give.resources?.[r]||0),0);
    const receiveTotal = RESOURCE_TYPES.reduce((n,r)=>n+Number(receive.resources?.[r]||0),0);
    if (giveTotal < 1 || receiveTotal < 1) {
      throw new RuleError('Ambos jugadores deben entregar al menos un recurso.');
    }

    this.transferResourceTokens(give.fromHexId, give.toHexId, give.resources, giveTotal);
    this.transferResourceTokens(receive.fromHexId, receive.toHexId, receive.resources, receiveTotal);

    this.playerMap.get(playerId).stats.trades++;
    partner.stats.trades++;

    this.completeAction('trade', {
      playerId,
      partnerId,
      give: clone(give),
      receive: clone(receive)
    });

    return true;
  }

  competitiveObjectives(playerId) {
    const player = this.playerMap.get(playerId);
    const civ = this.civFor(playerId);
    if (!player) throw new RuleError('Jugador inexistente.');

    const constructed = new Set(player.stats.buildingsConstructed || []);
    const requiredBuildings = Object.keys(civ.buildings);
    const allBuildings = requiredBuildings.every(type => constructed.has(type));

    const objectives = [
      {
        id: 'villagers8',
        achieved: player.stats.villagersTrained >= 8,
        points: 5
      },
      {
        id: 'allBuildings',
        achieved: allBuildings,
        points: 5
      },
      {
        id: 'trades5',
        achieved: player.stats.trades >= 5,
        points: 5
      },
      {
        id: 'technologies15',
        achieved: player.technologies.length >= 15,
        points: 20
      },
      {
        id: 'imperial',
        achieved: player.age === 'imperial',
        points: 10
      },
      {
        id: 'military15',
        achieved: player.stats.militaryTrained >= 15,
        points: 15
      },
      {
        id: 'militaryPower16',
        achieved: !!player.stats.reached16MilitaryPower,
        points: 10
      }
    ];

    const wonder = this.state.hexes.find(h => h.special === 'wonder');
    objectives.push({
      id: 'wonder',
      achieved: !!wonder && this.controllerOf(wonder.id) === playerId,
      points: 10,
      transferable: true
    });

    return objectives;
  }

  competitiveScore(playerId, { useFrozen = true } = {}) {
    const player = this.playerMap.get(playerId);
    if (!player) throw new RuleError('Jugador inexistente.');

    if (useFrozen && player.eliminatedScore) return clone(player.eliminatedScore);

    const objectives = this.competitiveObjectives(playerId);
    const achieved = objectives.filter(o => o.achieved);
    const objectivePoints = achieved.reduce((n,o)=>n+o.points,0);
    const objectiveStars = achieved.length;

    let primary = 0;
    let secondary = 0;
    let territories = 0;

    for (const hex of this.state.hexes) {
      if (hex.special) continue;
      if (this.controllerOf(hex.id) !== playerId) continue;

      territories++;
      if (SOURCE_TO_RESOURCE[hex.source] || hex.terrain === 'forest') primary++;
      else secondary++;
    }

    const eliminationStars = player.stats.eliminations || 0;
    const eliminationPoints = eliminationStars * 10;

    return {
      playerId,
      objectiveStars,
      eliminationStars,
      stars: objectiveStars + eliminationStars,
      objectivePoints,
      eliminationPoints,
      primaryTerritories: primary,
      secondaryTerritories: secondary,
      territories,
      territoryPoints: primary * 2 + secondary,
      militaryPower: player.militaryPower,
      points: objectivePoints + eliminationPoints + primary * 2 + secondary,
      objectives: clone(objectives)
    };
  }

  competitiveRankings() {
    return this.state.players
      .map(p => this.competitiveScore(p.id))
      .sort((a,b) =>
        b.points - a.points ||
        b.territories - a.territories ||
        b.militaryPower - a.militaryPower
      );
  }

  checkCompetitiveEnd() {
    if (this.state.mode !== 'competitive' || this.state.winnerId) return null;

    const scores = this.state.players.map(p => this.competitiveScore(p.id));
    if (!scores.some(s => s.stars >= 5)) return null;

    const rankings = this.competitiveRankings();
    this.state.competitiveFinal = rankings;
    this.state.winnerId = rankings[0]?.playerId || null;
    this.log('competitive-game-end', {
      winnerId: this.state.winnerId,
      rankings: clone(rankings)
    });
    return rankings;
  }

  modifiersFor(playerId) {
    this.state.turnModifiers[playerId] = this.state.turnModifiers[playerId] || {};
    return this.state.turnModifiers[playerId];
  }

  explorationHand(playerId) {
    const exp = this.state.exploration;
    exp.hands[playerId] = exp.hands[playerId] || [];
    return exp.hands[playerId];
  }

  consumeExplorationCard(playerId, cardId) {
    const hand = this.explorationHand(playerId);
    const i = hand.indexOf(cardId);
    if (i < 0) throw new RuleError('Esa carta no está en la mano del jugador.');
    hand.splice(i, 1);
    this.state.exploration.discard.push(cardId);
  }

  playExplorationCard(playerId, cardId, payload = {}) {
    const card = cardById(cardId);
    if (!card || card.immediate) throw new RuleError('Carta no jugable desde la mano.');
    if (!this.explorationHand(playerId).includes(cardId)) {
      throw new RuleError('Esa carta no está en la mano del jugador.');
    }

    const mod = this.modifiersFor(playerId);

    if (cardId === 'stash') {
      const hex = this.hexMap.get(payload.hexId);
      const hasVillager = this.state.units.some(
        u => u.ownerId === playerId && u.type === 'villager' && u.hexId === payload.hexId
      );
      const resources = payload.resources || {};
      const total = RESOURCE_TYPES.reduce((n, r) => n + Math.max(0, Number(resources[r] || 0)), 0);
      if (!hex || !hasVillager || total !== 2) {
        throw new RuleError('Alijo requiere un hexágono con Aldeano propio y exactamente 2 recursos.');
      }
      this.addResourceTokens(hex.id, resources);
    } else if (cardId === 'extra_hands') {
      const unit = this.state.units.find(u => u.id === payload.unitId && u.ownerId === playerId && u.type === 'villager');
      if (!unit) throw new RuleError('Manos Extra requiere un Aldeano propio.');
      mod.extraProductionUnitId = unit.id;
    } else if (cardId === 'local_guides') {
      this.cardMoveEconomicUnit(playerId, payload.unitId, payload.toHexId);
    } else if (cardId === 'caravan') {
      this.cardMoveResources(playerId, payload.fromHexId, payload.toHexId, payload.resources);
    } else if (cardId === 'abundant_hunt' || cardId === 'good_harvest') {
      const hex = this.hexMap.get(payload.hexId);
      const required = cardId === 'abundant_hunt' ? 'animals' : 'berries';
      if (!hex || hex.source !== required) {
        throw new RuleError('La carta debe aplicarse al tipo de recurso indicado.');
      }
      mod.productionHexBonus = mod.productionHexBonus || {};
      mod.productionHexBonus[hex.id] = (mod.productionHexBonus[hex.id] || 0) + 1;
    } else if (cardId === 'ingenuity') {
      mod.buildWoodDiscount = (mod.buildWoodDiscount || 0) + 1;
    } else if (cardId === 'cartography') {
      const top = this.state.exploration.deck.slice(0, 2);
      if (payload.order) {
        if (
          payload.order.length !== top.length ||
          [...payload.order].sort().join('|') !== [...top].sort().join('|')
        ) throw new RuleError('El nuevo orden debe contener exactamente las dos cartas superiores.');
        this.state.exploration.deck.splice(0, top.length, ...payload.order);
      }
      payload.peek = top;
    } else if (cardId === 'ancestral_knowledge') {
      if (!RESOURCE_TYPES.includes(payload.resourceType)) {
        throw new RuleError('Elegí qué recurso descontará Conocimiento Ancestral.');
      }
      mod.nextTechDiscount = { resourceType: payload.resourceType, amount: 1 };
    } else if (cardId === 'reinforcements') {
      const unit = this.state.units.find(u => u.id === payload.unitId && u.ownerId === playerId);
      if (!unit || !this.isCombatParticipant(playerId, unit)) {
        throw new RuleError('Refuerzos requiere una unidad propia capaz de combatir.');
      }
      mod.reinforcementUnitId = unit.id;
    } else if (cardId === 'forced_march') {
      const unit = this.state.units.find(u => u.id === payload.unitId && u.ownerId === playerId);
      if (!unit || this.effectiveUnitSpec(playerId, unit.type).category !== 'military') {
        throw new RuleError('Marcha Forzada requiere una unidad militar propia.');
      }
      mod.forcedMarchUnitId = unit.id;
    } else if (cardId === 'combat_power_1' || cardId === 'combat_power_2') {
      mod.combatCardPower = (mod.combatCardPower || 0) + (cardId === 'combat_power_1' ? 1 : 2);
    } else {
      throw new RuleError('Efecto de carta todavía no implementado.');
    }

    this.consumeExplorationCard(playerId, cardId);
    this.log('exploration-card-played', { playerId, cardId, payload: clone(payload) });
    return clone(card);
  }

  cardMoveEconomicUnit(playerId, unitId, toHexId) {
    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    const target = this.hexMap.get(toHexId);
    if (!unit || !target || unit.embarkedIn || unit.garrisonedIn) {
      throw new RuleError('Unidad o destino inválido para Guías Locales.');
    }
    if (this.effectiveUnitSpec(playerId, unit.type).category !== 'economic') {
      throw new RuleError('Guías Locales sólo mueve una unidad económica.');
    }
    const from = this.hexMap.get(unit.hexId);
    if (!from || hexDistance(from, target) !== 1 || target.terrain === 'water') {
      throw new RuleError('Guías Locales mueve exactamente 1 hexágono terrestre.');
    }
    if (this.state.units.some(u => u.hexId === toHexId && u.ownerId !== playerId && this.isCombatParticipant(u.ownerId, u))) {
      throw new RuleError('Guías Locales no puede entrar en defensa militar enemiga.');
    }
    unit.hexId = toHexId;
  }

  cardMoveResources(playerId, fromHexId, toHexId, resources = {}) {
    const from = this.hexMap.get(fromHexId);
    const to = this.hexMap.get(toHexId);
    if (!from || !to || hexDistance(from, to) !== 1) {
      throw new RuleError('Caravana mueve recursos exactamente 1 hexágono.');
    }
    if (this.controllerOf(fromHexId) !== playerId) {
      throw new RuleError('Caravana debe partir de un territorio controlado.');
    }
    const total = RESOURCE_TYPES.reduce((n, r) => n + Math.max(0, Number(resources[r] || 0)), 0);
    if (total < 1 || total > 3) throw new RuleError('Caravana mueve entre 1 y 3 recursos.');

    const requested = [];
    for (const type of RESOURCE_TYPES) {
      const amount = Math.max(0, Number(resources[type] || 0));
      const available = from.looseResources.filter(x => x.type === type).slice(0, amount);
      if (available.length !== amount) throw new RuleError('No hay suficientes recursos para Caravana.');
      requested.push(...available);
    }
    const ids = new Set(requested.map(x => x.id));
    from.looseResources = from.looseResources.filter(x => !ids.has(x.id));
    to.looseResources.push(...requested);
  }

  drawExplorationCard(playerId, mountainHexId) {
    const mountain = this.hexMap.get(mountainHexId);
    if (!mountain || mountain.terrain !== 'mountain') {
      throw new RuleError('La exploración debe originarse en una Montaña.');
    }
    if (mountain.explored) {
      throw new RuleError('Esa Montaña ya fue explorada.');
    }

    const exp = this.state.exploration;
    if (!exp.deck.length) {
      exp.deck = shuffleCards(
        exp.discard.splice(0),
        `${exp.seed}:recycle:${++exp.shuffleCount}`
      );
    }
    if (!exp.deck.length) throw new RuleError('No quedan cartas de Exploración.');

    mountain.explored = true;
    const cardId = exp.deck.shift();
    const card = cardById(cardId);
    if (!card) throw new RuleError('Carta de Exploración desconocida.');

    if (card.immediate) {
      this.resolveImmediateExplorationCard(playerId, card, mountain);
    } else {
      this.explorationHand(playerId).push(card.id);
    }

    this.log('exploration-draw', {
      playerId,
      mountainHexId,
      cardId: card.id,
      immediate: card.immediate
    });
    return clone(card);
  }

  resolveImmediateExplorationCard(playerId, card, mountain) {
    const exp = this.state.exploration;

    if (card.id === 'treasure') {
      this.addResourceTokens(mountain.id, { gold: 2 });
      exp.discard.push(card.id);
      return;
    }

    if (card.id === 'mercenaries') {
      this.addUnit(playerId, 'militia', mountain.id);
      exp.discard.push(card.id);
      return;
    }

    if (card.id === 'relic') {
      mountain.relics = (mountain.relics || 0) + 1;
      exp.deck.push(card.id);
      exp.deck = shuffleCards(
        exp.deck,
        `${exp.seed}:relic:${++exp.shuffleCount}`
      );
      return;
    }

    exp.discard.push(card.id);
  }

  exploreMountain(playerId, mountainHexId) {
    const mountain = this.hexMap.get(mountainHexId);
    if (!mountain || mountain.terrain !== 'mountain' || mountain.explored) return null;
    return this.drawExplorationCard(playerId, mountainHexId);
  }

  pickupRelic(playerId, unitId) {
    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    if (!unit) throw new RuleError('Unidad religiosa inválida.');
    const spec = this.effectiveUnitSpec(playerId, unit.type);
    if (spec.category !== 'religious') {
      throw new RuleError('Sólo una unidad religiosa puede transportar Reliquias.');
    }

    const hex = this.hexMap.get(unit.hexId);
    if (!hex || (hex.relics || 0) < 1) throw new RuleError('No hay Reliquia en ese hexágono.');

    hex.relics--;
    unit.relics = (unit.relics || 0) + 1;
    this.log('relic-pickup', { playerId, unitId, hexId: hex.id });
    return unit.relics;
  }

  depositRelics(playerId, unitId, monasteryId) {
    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    const monastery = this.state.buildings.find(
      b => b.id === monasteryId && b.ownerId === playerId && b.type === 'monastery'
    );

    if (!unit || !monastery || unit.hexId !== monastery.hexId) {
      throw new RuleError('La unidad religiosa debe estar en el Monasterio propio.');
    }
    if (this.effectiveUnitSpec(playerId, unit.type).category !== 'religious') {
      throw new RuleError('Sólo una unidad religiosa puede depositar Reliquias.');
    }

    const amount = unit.relics || 0;
    monastery.relics = (monastery.relics || 0) + amount;
    unit.relics = 0;
    this.log('relic-deposit', { playerId, unitId, monasteryId, amount });
    return amount;
  }

  dropUnitRelics(unit, hexId = unit.hexId) {
    const amount = unit?.relics || 0;
    if (!amount) return 0;
    const hex = this.hexMap.get(hexId);
    if (hex) hex.relics = (hex.relics || 0) + amount;
    unit.relics = 0;
    return amount;
  }

  applyStartTurnIncome(playerId) {
    let relicCount = 0;
    for (const monastery of this.state.buildings.filter(
      b => b.ownerId === playerId && b.type === 'monastery'
    )) {
      const count = monastery.relics || 0;
      if (!count) continue;
      relicCount += count;
      this.addResourceTokens(monastery.hexId, { gold: count * 2 });
    }

    if (relicCount) {
      this.log('relic-income', {
        playerId,
        relics: relicCount,
        gold: relicCount * 2
      });
    }
    return relicCount * 2;
  }

  plunderAfterCombat(playerId, fromHexId, toHexId, resources) {
    this.assertActive(playerId);

    if (!this.hasEffect(playerId, 'plunder:2')) {
      throw new RuleError('Saqueo no está habilitado.');
    }

    const lastCombat = [...this.state.log].reverse().find(x => x.type === 'combat');
    if (
      !lastCombat ||
      lastCombat.playerId !== playerId ||
      lastCombat.data?.winnerId !== playerId ||
      lastCombat.data?.targetHexId !== fromHexId
    ) {
      throw new RuleError('Saqueo requiere haber ganado la batalla más reciente en ese hexágono.');
    }

    const destinationHasArmy = this.state.units.some(
      u => u.ownerId === playerId && u.hexId === toHexId && this.isCombatParticipant(playerId, u)
    );
    if (!destinationHasArmy && toHexId !== fromHexId) {
      throw new RuleError('Los recursos saqueados deben acompañar al ejército vencedor.');
    }

    const moved = this.transferResourceTokens(fromHexId, toHexId, resources, 2);
    this.log('plunder', { playerId, fromHexId, toHexId, resources: clone(resources), moved });
    return moved;
  }

  combatParticipants(playerId, targetHexId, directIds = []) {
    const target = this.hexMap.get(targetHexId);
    const ids = new Set(directIds);
    const out = [];

    for (const u of this.state.units) {
      if (u.ownerId !== playerId || !this.isCombatParticipant(playerId, u)) continue;

      const spec = this.effectiveUnitSpec(playerId, u.type);

      if (
        spec.tags?.includes('siege') &&
        !this.state.units.some(v => v.ownerId === playerId && v.type === 'villager' && v.hexId === u.hexId)
      ) {
        continue;
      }

      let range = spec.range;

      if (
        u.type === 'archer' &&
        this.hasEffect(playerId, 'howdah:+1') &&
        this.state.units.some(e => e.ownerId === playerId && e.type === 'elephant' && e.hexId === u.hexId)
      ) {
        range += 1;
      }

      if (
        ids.has(u.id) ||
        u.hexId === targetHexId ||
        (range > 0 && hexDistance(this.hexMap.get(u.hexId), target) <= range)
      ) {
        out.push(u);
      }
    }

    return [...new Map(out.map(u => [u.id, u])).values()];
  }

  combatForceBreakdown(playerId, participants, enemyParticipants, targetHexId, { role = 'attacker', directIds = [] } = {}) {
    const civ = this.civFor(playerId);
    const target = this.hexMap.get(targetHexId);
    const direct = new Set(directIds);
    const enemyBuildings = this.state.buildings.filter(b => b.hexId === targetHexId && b.ownerId !== playerId);

    const base = participants.reduce(
      (n, u) => n + this.effectiveUnitSpec(playerId, u.type).force,
      0
    );

    const ruleMap = new Map();
    for (const rule of civ.combatBonuses || []) {
      const targetKey = rule.target || rule.targetType || rule.targetTag || '';
      ruleMap.set(`${rule.source}|${targetKey}`, { ...rule });
    }

    for (const effect of this.activeEffects(playerId)) {
      const m = effect.match(/^bonus:([^:]+):([^:]+):([+-]?\d+)$/);
      if (!m) continue;
      const source = m[1];
      const targetName = m[2];
      const amount = Number(m[3]);
      let rule;
      if (targetName === 'building' || targetName === 'attackingBuilding') {
        rule = { source, target: 'building', amount, attackingOnly: targetName === 'attackingBuilding' };
      } else if (targetName === 'shipsNoRange') {
        rule = { source, targetTag: 'shipNoRange', amount };
      } else {
        rule = { source, targetType: targetName, amount };
      }
      const targetKey = rule.target || rule.targetType || rule.targetTag || '';
      ruleMap.set(`${source}|${targetKey}`, rule);
    }

    let pairBonuses = 0;
    const pairDetails = [];

    for (const rule of ruleMap.values()) {
      if (rule.attackingOnly && role !== 'attacker') continue;

      const sources = participants.filter(u => u.type === rule.source);
      if (!sources.length) continue;

      let targets = 0;
      if (rule.target === 'building') {
        targets = enemyBuildings.length;
      } else if (rule.targetType) {
        targets = enemyParticipants.filter(u => u.type === rule.targetType).length;
      } else if (rule.targetTag === 'shipNoRange') {
        targets = enemyParticipants.filter(u => {
          const s = this.effectiveUnitSpec(u.ownerId, u.type);
          return s.tags?.includes('ship') && s.range === 0;
        }).length;
      } else if (rule.targetTag) {
        targets = enemyParticipants.filter(u => this.effectiveUnitSpec(u.ownerId, u.type).tags?.includes(rule.targetTag)).length;
      }

      const pairs = Math.min(sources.length, targets);
      if (pairs > 0) {
        const value = pairs * rule.amount;
        pairBonuses += value;
        pairDetails.push({ source: rule.source, target: rule.target || rule.targetType || rule.targetTag, pairs, amount: rule.amount, value });
      }
    }

    let contextual = 0;
    const contextDetails = [];
    const effects = this.activeEffects(playerId);
    const combatMod = this.modifiersFor(playerId);

    if (
      combatMod.reinforcementUnitId &&
      participants.some(u => u.id === combatMod.reinforcementUnitId)
    ) {
      contextual += 1;
      contextDetails.push({ effect: 'exploration:reinforcements', value: 1 });
    }

    for (const effect of effects) {
      let m = effect.match(/^militiaGroupForce:(\d+):([+-]?\d+)$/);
      if (m) {
        const count = participants.filter(u => u.type === 'militia').length;
        if (count >= Number(m[1])) {
          contextual += Number(m[2]);
          contextDetails.push({ effect, value: Number(m[2]) });
        }
      }

      m = effect.match(/^charge:([+-]?\d+)$/);
      if (m && role === 'attacker') {
        const count = participants.filter(u => {
          const spec = this.effectiveUnitSpec(playerId, u.type);
          return direct.has(u.id) && spec.tags?.includes('mounted');
        }).length;
        if (count) {
          const value = count * Number(m[1]);
          contextual += value;
          contextDetails.push({ effect, value });
        }
      }

      m = effect.match(/^mahouts:([+-]?\d+)$/);
      if (m) {
        const hasElephant = participants.some(u => u.type === 'elephant');
        const hasFoot = participants.some(u => this.effectiveUnitSpec(playerId, u.type).tags?.includes('foot'));
        if (hasElephant && hasFoot) {
          contextual += Number(m[1]);
          contextDetails.push({ effect, value: Number(m[1]) });
        }
      }
    }

    let buildingSupport = 0;
    const buildingDetails = [];

    for (const [type, support] of Object.entries(civ.buildingSupport || {})) {
      for (const building of this.state.buildings.filter(b => b.ownerId === playerId && b.type === type)) {
        const h = this.hexMap.get(building.hexId);
        if (h && hexDistance(h, target) <= support.range) {
          buildingSupport += support.force;
          buildingDetails.push({ type, buildingId: building.id, value: support.force });
        }
      }
    }

    if (
      this.hasEffect(playerId, 'towerOwnHex:+1') &&
      this.state.buildings.some(b => b.ownerId === playerId && b.type === 'tower' && b.hexId === targetHexId)
    ) {
      buildingSupport += 1;
      buildingDetails.push({ type: 'tower', value: 1 });
    }

    return {
      base,
      pairBonuses,
      contextual,
      buildingSupport,
      total: base + pairBonuses + contextual + buildingSupport,
      details: { pairs: pairDetails, contextual: contextDetails, buildings: buildingDetails }
    };
  }

  maxBidFor(playerId, { role, participants, targetHexId }) {
    const player = this.playerMap.get(playerId);
    let max = player.maxMilitaryBid;

    if (role === 'attacker') {
      for (const effect of this.activeEffects(playerId)) {
        const m = effect.match(/^maxBidWhenAttacking:([^:]+):(\d+):([+-]?\d+)$/);
        if (m && participants.filter(u => u.type === m[1]).length >= Number(m[2])) {
          max += Number(m[3]);
        }
      }
    }

    if (
      role === 'defender' &&
      this.hasEffect(playerId, 'towerDefenseMaxBid:+1') &&
      this.state.buildings.some(b => b.ownerId === playerId && b.type === 'tower' && b.hexId === targetHexId)
    ) {
      max += 1;
    }

    return Math.min(max, player.militaryPower);
  }

  attack(
    playerId,
    {
      unitIds,
      targetHexId,
      attackerBid = 0,
      defenderBid = 0,
      loserCasualtyIds = null,
      healedCasualtyIds = null,
      convertedUnitIds = null
    } = {}
  ) {
    this.assertActive(playerId);
    this.assertPhase('military');

    const target = this.hexMap.get(targetHexId);
    if (!target) throw new RuleError('Objetivo inexistente.');

    const direct = (unitIds || []).map(id =>
      this.state.units.find(u => u.id === id)
    );

    if (
      !direct.length ||
      direct.some(
        u =>
          !u ||
          u.ownerId !== playerId ||
          !this.isCombatParticipant(playerId, u)
      )
    ) {
      throw new RuleError('Ataque inválido.');
    }

    if (new Set(direct.map(u => u.hexId)).size !== 1) {
      throw new RuleError('El grupo atacante debe partir del mismo hexágono.');
    }

    for (const u of direct) {
      const spec = this.effectiveUnitSpec(playerId, u.type);

      const path = shortestMovementPath(
        this.state.hexes,
        u.hexId,
        targetHexId,
        {
          water: !!spec.water,
          blockedEdge: (a, b) => this.edgeBlocked(a, b)
        }
      );

      if (!path || path.length - 1 > spec.move) {
        throw new RuleError(`${spec.name} no llega al objetivo.`);
      }
    }

    const defenderMilitary = this.state.units.filter(
      u =>
        u.hexId === targetHexId &&
        u.ownerId !== playerId &&
        this.isCombatParticipant(u.ownerId, u)
    );

    const defenderId =
      defenderMilitary[0]?.ownerId ||
      this.state.buildings.find(
        b => b.hexId === targetHexId && b.ownerId !== playerId
      )?.ownerId ||
      (
        target.special === 'tc' && target.tcOwnerId !== playerId
          ? target.tcOwnerId
          : null
      );

    if (!defenderId) throw new RuleError('No hay objetivo enemigo.');

    if (!defenderMilitary.length) {
      this.occupyUndefended(playerId, targetHexId);

      direct.forEach(u => {
        u.hexId = targetHexId;
      });

      const result = {
        winnerId: playerId,
        defenderId,
        targetHexId,
        unopposed: true
      };

      this.completeAction('combat', result);
      return result;
    }

    const attacker = this.playerMap.get(playerId);
    const defender = this.playerMap.get(defenderId);

    const atkParts = this.combatParticipants(
      playerId,
      targetHexId,
      direct.map(u => u.id)
    );

    const defParts = this.combatParticipants(
      defenderId,
      targetHexId,
      []
    );

    const attackerMaxBid = this.maxBidFor(playerId, {
      role: 'attacker',
      participants: atkParts,
      targetHexId
    });
    const defenderMaxBid = this.maxBidFor(defenderId, {
      role: 'defender',
      participants: defParts,
      targetHexId
    });

    if (attackerBid < 0 || attackerBid > attackerMaxBid) {
      throw new RuleError('Apuesta atacante inválida.');
    }

    if (defenderBid < 0 || defenderBid > defenderMaxBid) {
      throw new RuleError('Apuesta defensora inválida.');
    }

    const atkBreakdown = this.combatForceBreakdown(
      playerId,
      atkParts,
      defParts,
      targetHexId,
      { role: 'attacker', directIds: direct.map(u => u.id) }
    );

    const defBreakdown = this.combatForceBreakdown(
      defenderId,
      defParts,
      atkParts,
      targetHexId,
      { role: 'defender', directIds: [] }
    );

    const atkForce = atkBreakdown.total;
    const defForce = defBreakdown.total;

    const attackerCardPower = this.modifiersFor(playerId).combatCardPower || 0;
    const defenderCardPower = this.modifiersFor(defenderId).combatCardPower || 0;
    const atkTotal = atkForce + attackerBid + attackerCardPower;
    const defTotal = defForce + defenderBid + defenderCardPower;
    const attackerWins = atkTotal > defTotal;

    attacker.militaryPower -= attackerBid;
    defender.militaryPower -= defenderBid;

    if (attackerWins && this.hasEffect(playerId, 'recoverBidOnWin:1') && attackerBid > 0) {
      attacker.militaryPower = Math.min(MAX_MILITARY_POWER, attacker.militaryPower + 1);
    }
    if (!attackerWins && this.hasEffect(defenderId, 'recoverBidOnWin:1') && defenderBid > 0) {
      defender.militaryPower = Math.min(MAX_MILITARY_POWER, defender.militaryPower + 1);
    }

    const loserParts = attackerWins ? defParts : atkParts;
    const loserId = attackerWins ? defenderId : playerId;
    const difference = Math.abs(atkTotal - defTotal);
    const casualtiesNeeded = Math.min(difference, loserParts.length);

    let casualtyIds;

    if (loserCasualtyIds) {
      const valid = new Set(loserParts.map(u => u.id));
      casualtyIds = loserCasualtyIds
        .filter(id => valid.has(id))
        .slice(0, casualtiesNeeded);

      if (casualtyIds.length !== casualtiesNeeded) {
        throw new RuleError(
          `El derrotado debe elegir ${casualtiesNeeded} bajas.`
        );
      }
    } else {
      casualtyIds = [...loserParts]
        .sort(
          (a, b) =>
            this.effectiveUnitSpec(loserId, a.type).force - this.effectiveUnitSpec(loserId, b.type).force
        )
        .slice(0, casualtiesNeeded)
        .map(u => u.id);
    }

    const initialCasualtyIds = [...casualtyIds];
    const loserReligiousSurvivors = loserParts.filter(
      u =>
        this.effectiveUnitSpec(loserId, u.type).category === 'religious' &&
        !casualtyIds.includes(u.id)
    );
    const rescueCount = Math.min(loserReligiousSurvivors.length, casualtyIds.length);
    let rescuedIds = [];

    if (rescueCount > 0) {
      if (healedCasualtyIds) {
        const casualtySet = new Set(casualtyIds);
        rescuedIds = [...new Set(healedCasualtyIds)]
          .filter(id => casualtySet.has(id))
          .slice(0, rescueCount);

        if (rescuedIds.length > rescueCount) {
          throw new RuleError('Se intentaron curar más bajas de las permitidas.');
        }
      } else {
        rescuedIds = casualtyIds
          .map(id => this.state.units.find(u => u.id === id))
          .filter(Boolean)
          .sort(
            (a, b) =>
              this.effectiveUnitSpec(loserId, b.type).force -
              this.effectiveUnitSpec(loserId, a.type).force
          )
          .slice(0, rescueCount)
          .map(u => u.id);
      }

      const rescued = new Set(rescuedIds);
      casualtyIds = casualtyIds.filter(id => !rescued.has(id));
    }

    const dead = new Set(casualtyIds);

    this.state.units = this.state.units.filter(
      u => !dead.has(u.id)
    );

    const winnerId = attackerWins ? playerId : defenderId;
    const winnerParts = attackerWins ? atkParts : defParts;
    const winnerReligious = winnerParts.filter(
      u =>
        this.state.units.some(x => x.id === u.id) &&
        this.effectiveUnitSpec(winnerId, u.type).category === 'religious'
    );

    const conversionCandidates = loserParts.filter(
      u =>
        this.state.units.some(x => x.id === u.id) &&
        u.ownerId === loserId
    );
    const convertLimit = Math.min(winnerReligious.length, conversionCandidates.length);
    let selectedConversions = [];

    if (convertLimit > 0) {
      if (convertedUnitIds) {
        const allowed = new Set(conversionCandidates.map(u => u.id));
        selectedConversions = [...new Set(convertedUnitIds)]
          .filter(id => allowed.has(id))
          .slice(0, convertLimit);

        if (selectedConversions.length !== Math.min(convertLimit, new Set(convertedUnitIds).size)) {
          throw new RuleError('Hay una unidad inválida entre las conversiones elegidas.');
        }
      } else {
        selectedConversions = [...conversionCandidates]
          .sort(
            (a, b) =>
              this.effectiveUnitSpec(loserId, b.type).force -
              this.effectiveUnitSpec(loserId, a.type).force
          )
          .slice(0, convertLimit)
          .map(u => u.id);
      }
    }

    const converted = [];
    const heresyKilled = [];

    for (const id of selectedConversions) {
      const unit = this.state.units.find(u => u.id === id);
      if (!unit) continue;

      const protectedByHeresy =
        this.hasEffect(loserId, 'heresy') ||
        this.hasEffect(loserId, `heresyUnit:${unit.type}`);

      if (protectedByHeresy) {
        this.state.units = this.state.units.filter(u => u.id !== id);
        heresyKilled.push(id);
      } else {
        unit.ownerId = winnerId;
        unit.hexId = targetHexId;
        unit.embarkedIn = null;
        unit.garrisonedIn = null;
        converted.push(id);
      }
    }

    const tc = this.playerMap.get(loserId).tcHexId;

    for (const u of this.state.units) {
      if (
        u.ownerId === loserId &&
        loserParts.some(p => p.id === u.id)
      ) {
        u.hexId = tc;
      }
    }

    if (attackerWins) {
      for (const u of this.state.units) {
        if (direct.some(d => d.id === u.id)) {
          u.hexId = targetHexId;
        }
      }

      this.state.units.forEach(u => {
        if (
          u.hexId === targetHexId &&
          u.ownerId === defenderId &&
          UNIT_TYPES[u.type].category !== 'military'
        ) {
          u.hexId = defender.tcHexId;
        }
      });

      const destroyedBuildings = this.state.buildings.filter(
        b => b.hexId === targetHexId && b.ownerId === defenderId
      );
      const destroyedBuildingIds = new Set(destroyedBuildings.map(b => b.id));
      for (const building of destroyedBuildings) {
        if (building.type === 'monastery' && (building.relics || 0) > 0) {
          target.relics = (target.relics || 0) + building.relics;
          building.relics = 0;
        }
      }
      this.state.buildings = this.state.buildings.filter(
        b => !destroyedBuildingIds.has(b.id)
      );
      for (const unit of this.state.units) {
        if (unit.garrisonedIn && destroyedBuildingIds.has(unit.garrisonedIn)) {
          unit.garrisonedIn = null;
          unit.hexId = targetHexId;
        }
      }

      if (
        target.special === 'tc' &&
        target.tcOwnerId === defenderId
      ) {
        this.eliminatePlayer(defenderId, playerId);
      }
    }

    const result = {
      attackerId: playerId,
      defenderId,
      targetHexId,
      attackerForce: atkForce,
      defenderForce: defForce,
      attackerBreakdown: atkBreakdown,
      defenderBreakdown: defBreakdown,
      attackerBid,
      defenderBid,
      attackerCardPower,
      defenderCardPower,
      attackerMaxBid,
      defenderMaxBid,
      attackerTotal: atkTotal,
      defenderTotal: defTotal,
      difference,
      initialCasualties: initialCasualtyIds,
      rescuedByReligious: rescuedIds,
      casualties: casualtyIds,
      converted,
      heresyKilled,
      winnerId
    };

    delete this.modifiersFor(playerId).reinforcementUnitId;
    delete this.modifiersFor(playerId).combatCardPower;
    delete this.modifiersFor(defenderId).reinforcementUnitId;
    delete this.modifiersFor(defenderId).combatCardPower;

    this.completeAction('combat', result);
    return result;
  }

  eliminatePlayer(playerId, killerId = null) {
    const p = this.playerMap.get(playerId);
    if (!p || p.eliminated) return;

    if (this.state.mode === 'competitive') {
      p.eliminatedScore = this.competitiveScore(playerId, { useFrozen: false });
    }

    if (killerId && this.playerMap.get(killerId)) {
      this.playerMap.get(killerId).stats.eliminations++;
    }

    p.eliminated = true;

    for (const unit of this.state.units.filter(u => u.ownerId === playerId)) {
      this.dropUnitRelics(unit, unit.hexId);
    }

    for (const building of this.state.buildings.filter(b => b.ownerId === playerId)) {
      if (building.type === 'monastery' && (building.relics || 0) > 0) {
        const hex = this.hexMap.get(building.hexId);
        if (hex) hex.relics = (hex.relics || 0) + building.relics;
      }
    }

    this.state.units = this.state.units.filter(u => u.ownerId !== playerId);
    this.state.buildings = this.state.buildings.filter(b => b.ownerId !== playerId);

    this.log('player-eliminated', { playerId, killerId });

    if (this.state.mode === 'ffa') {
      const alive = this.state.players.filter(x => !x.eliminated);
      if (alive.length === 1) {
        this.state.winnerId = alive[0].id;
        this.log('game-end', { winnerId: alive[0].id });
      }
    } else {
      this.checkCompetitiveEnd();
    }
  }

  snapshot() {
    return clone(this.state);
  }
}
