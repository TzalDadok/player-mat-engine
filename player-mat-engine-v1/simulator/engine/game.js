import {
  PHASES, AGES, AGE_PRODUCTION_LIMIT, RESOURCE_TYPES, MAX_MILITARY_POWER, MAX_MILITARY_BID,
  UNIT_TYPES, BUILDING_TYPES, AGE_COSTS, SOURCE_TO_RESOURCE, EXHAUSTED_TO
} from './constants.js';
import { generateHexRadius, hexDistance, physicalNeighbors, shortestMovementPath } from './hex.js';
import { getCivilization } from '../civs/index.js';

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

  static create({ players, radius = 2, seedMap = true, mode = 'ffa' } = {}) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
      throw new RuleError('La partida requiere entre 2 y 4 jugadores.');
    }

    const hexes = generateHexRadius(radius);
    if (seedMap) AoEGame.seedDemoMap(hexes);

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
        stats: { villagersTrained: 0, militaryTrained: 0, trades: 0 }
      })),
      units: [],
      buildings: [],
      log: []
    };

    const game = new AoEGame(state);
    game.setupPlayers();
    game.log('game-start', { mode, players: state.players.map(p => p.id) });
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
    const land = this.state.hexes.filter(h => h.terrain !== 'water' && h.special !== 'wonder');
    const starts = [
      land[0],
      land[land.length - 1],
      land[Math.floor(land.length / 3)],
      land[Math.floor(land.length * 2 / 3)]
    ];

    this.state.players.forEach((p, i) => {
      const hex = starts[i];
      p.tcHexId = hex.id;
      hex.special = 'tc';
      hex.tcOwnerId = p.id;
      hex.source = null;
      this.addUnit(p.id, 'villager', hex.id);
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
    this.log('turn-start', { playerId: this.activePlayer.id });
  }

  addUnit(ownerId, type, hexId) {
    if (!UNIT_TYPES[type]) throw new RuleError(`Unidad desconocida: ${type}`);
    const u = { id: uid('U'), ownerId, type, hexId, cargo: [] };
    this.state.units.push(u);
    return u;
  }

  addBuilding(ownerId, type, hexId) {
    if (!BUILDING_TYPES[type]) throw new RuleError(`Edificio desconocido: ${type}`);
    const b = { id: uid('B'), ownerId, type, hexId };
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
    const unitOwners = [...new Set(this.state.units.filter(u => u.hexId === hexId).map(u => u.ownerId))];
    if (unitOwners.length === 1) return unitOwners[0];
    if (unitOwners.length > 1) return null;

    const buildingOwners = [...new Set(this.state.buildings.filter(b => b.hexId === hexId).map(b => b.ownerId))];
    return buildingOwners.length === 1 ? buildingOwners[0] : null;
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

  canAffordControlled(playerId, cost = {}) {
    const totals = Object.fromEntries(RESOURCE_TYPES.map(r => [r, 0]));

    for (const id of this.controlledHexIds(playerId)) {
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

    for (const hexId of this.controlledHexIds(playerId)) {
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

  produce(playerId, selections) {
    this.assertActive(playerId);
    this.assertPhase('economy');

    const player = this.playerMap.get(playerId);
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

      const villagers = this.state.units.filter(
        u => u.ownerId === playerId && u.hexId === hex.id && u.type === 'villager'
      ).length;

      let type = null;
      let amount = 0;
      let primary = false;

      if (sel.mode === 'coast') {
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
          amount = Math.min(farms, villagers);

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

      if (amount <= 0) throw new RuleError(`No hay productores elegibles en ${hex.id}.`);

      this.addResourceTokens(hex.id, { [type]: amount });
      results.push({ hexId: hex.id, resourceType: type, amount, mode: sel.mode });

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

    if (units.some(u => !u || u.ownerId !== playerId)) {
      throw new RuleError('Hay una unidad inválida o enemiga.');
    }

    const origins = [...new Set(units.map(u => u.hexId))];

    if (origins.length !== 1) {
      throw new RuleError('Las unidades que se mueven juntas deben partir del mismo hexágono.');
    }

    if (
      this.state.phase === 'economy' &&
      units.some(u => UNIT_TYPES[u.type].category !== 'economic')
    ) {
      throw new RuleError('Economía sólo mueve unidades económicas.');
    }

    const target = this.hexMap.get(toHexId);
    if (!target) throw new RuleError('Destino inexistente.');

    for (const unit of units) {
      const spec = this.effectiveUnitSpec(playerId, unit.type);
      const path = shortestMovementPath(this.state.hexes, unit.hexId, toHexId, {
        water: !!spec.water,
        blockedEdge: (a, b) => this.edgeBlocked(a, b)
      });

      if (!path || path.length - 1 > spec.move) {
        throw new RuleError(`${spec.name} no puede llegar al destino.`);
      }
    }

    const enemyMilitary = this.state.units.filter(
      u =>
        u.hexId === toHexId &&
        u.ownerId !== playerId &&
        this.isCombatParticipant(u.ownerId, u)
    );

    if (enemyMilitary.length) {
      throw new RuleError('El destino tiene defensa militar: usá attack().', 'COMBAT_REQUIRED');
    }

    const movingMilitary = units.some(u => UNIT_TYPES[u.type].category === 'military');
    if (movingMilitary) this.occupyUndefended(playerId, toHexId);

    units.forEach(u => {
      u.hexId = toHexId;
    });

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
      u.hexId = this.playerMap.get(u.ownerId).tcHexId;
    }

    this.state.buildings = this.state.buildings.filter(
      b => !(b.hexId === hexId && b.ownerId !== attackerId)
    );

    const hex = this.hexMap.get(hexId);

    if (hex.special === 'tc' && hex.tcOwnerId && hex.tcOwnerId !== attackerId) {
      this.eliminatePlayer(hex.tcOwnerId);
    }
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
      u =>
        u.id === villagerId &&
        u.ownerId === playerId &&
        u.type === 'villager' &&
        u.hexId === hexId
    );

    if (!hex || !villager) {
      throw new RuleError('Se requiere un Aldeano propio en el hexágono.');
    }

    if (hex.terrain === 'water' && buildingType !== 'port') {
      throw new RuleError('No se puede construir ahí.');
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

    this.spendAt(hexId, rule.cost);
    const building = this.addBuilding(playerId, buildingType, hexId);
    this.completeAction('build', { buildingId: building.id, buildingType, hexId });
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

    for (const { r, base, rule } of items) {
      if (!this.ageAllows(player, rule.age)) {
        throw new RuleError(`${base.name} todavía no está disponible en esta Edad.`);
      }

      const options = [
        { age: rule.age, building: rule.building, cost: rule.cost },
        ...(rule.alternateTraining || [])
      ].filter(o => this.ageAllows(player, o.age));

      let option = null;
      let spawnHexId = null;

      if (!r.buildingId) {
        option = options.find(o => o.building === 'tc');
        if (option) spawnHexId = player.tcHexId;
      } else {
        const building = this.state.buildings.find(
          b => b.id === r.buildingId && b.ownerId === playerId
        );

        if (!building) throw new RuleError('Edificio de entrenamiento inválido.');

        option = options.find(o => o.building === building.type);
        if (option) spawnHexId = building.hexId;
      }

      if (!option || !spawnHexId) {
        throw new RuleError(`No hay un punto válido para entrenar ${base.name}.`);
      }

      const cost = this.effectiveUnitCost(playerId, r.type, option.cost);

      if (r.type === 'villager') {
        this.spendControlled(playerId, cost);
        player.stats.villagersTrained++;
      } else {
        this.spendAt(spawnHexId, cost);
        if (base.category === 'military') player.stats.militaryTrained++;
      }

      created.push(this.addUnit(playerId, r.type, spawnHexId));
    }

    this.completeAction('train', {
      units: created.map(u => ({ id: u.id, type: u.type, hexId: u.hexId }))
    });

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

    this.spendControlled(playerId, rule.cost);
    player.technologies.push(id);
    this.completeAction('research', { id, name: rule.name, effects: rule.effects });
    return rule;
  }

  advanceAge(playerId) {
    this.assertActive(playerId);
    this.assertPhase('technology');

    const p = this.playerMap.get(playerId);
    const i = AGES.indexOf(p.age);

    if (i >= AGES.length - 1) throw new RuleError('Ya está en Edad Imperial.');

    const next = AGES[i + 1];
    this.spendControlled(playerId, AGE_COSTS[next]);
    p.age = next;
    this.completeAction('advance-age', { age: next });
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

      this.spendControlled(playerId, { wood: 3 });

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

    this.spendControlled(playerId, { gold: 1 });
    p.militaryPower++;
    this.completeAction('instruct', { militaryPower: p.militaryPower });
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
      loserCasualtyIds = null
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

    if (
      attackerBid < 0 ||
      attackerBid > Math.min(attacker.maxMilitaryBid, attacker.militaryPower)
    ) {
      throw new RuleError('Apuesta atacante inválida.');
    }

    if (
      defenderBid < 0 ||
      defenderBid > Math.min(defender.maxMilitaryBid, defender.militaryPower)
    ) {
      throw new RuleError('Apuesta defensora inválida.');
    }

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

    const atkForce = atkParts.reduce(
      (n, u) => n + this.effectiveUnitSpec(playerId, u.type).force,
      0
    );

    const defForce = defParts.reduce(
      (n, u) => n + this.effectiveUnitSpec(defenderId, u.type).force,
      0
    );

    const atkTotal = atkForce + attackerBid;
    const defTotal = defForce + defenderBid;
    const attackerWins = atkTotal > defTotal;

    attacker.militaryPower -= attackerBid;
    defender.militaryPower -= defenderBid;

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

    const dead = new Set(casualtyIds);

    this.state.units = this.state.units.filter(
      u => !dead.has(u.id)
    );

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

      this.state.buildings = this.state.buildings.filter(
        b =>
          !(
            b.hexId === targetHexId &&
            b.ownerId === defenderId
          )
      );

      if (
        target.special === 'tc' &&
        target.tcOwnerId === defenderId
      ) {
        this.eliminatePlayer(defenderId);
      }
    }

    const result = {
      attackerId: playerId,
      defenderId,
      targetHexId,
      attackerForce: atkForce,
      defenderForce: defForce,
      attackerBid,
      defenderBid,
      attackerTotal: atkTotal,
      defenderTotal: defTotal,
      difference,
      casualties: casualtyIds,
      winnerId: attackerWins ? playerId : defenderId
    };

    this.completeAction('combat', result);
    return result;
  }

  eliminatePlayer(playerId) {
    const p = this.playerMap.get(playerId);
    if (!p || p.eliminated) return;

    p.eliminated = true;

    this.state.units = this.state.units.filter(
      u => u.ownerId !== playerId
    );

    this.state.buildings = this.state.buildings.filter(
      b => b.ownerId !== playerId
    );

    this.log('player-eliminated', { playerId });
  }

  snapshot() {
    return clone(this.state);
  }
}
