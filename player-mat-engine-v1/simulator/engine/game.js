import {
  PHASES, AGES, AGE_PRODUCTION_LIMIT, RESOURCE_TYPES,
  UNIT_TYPES, BUILDING_TYPES, AGE_COSTS, SOURCE_TO_RESOURCE
} from './constants.js';
import { generateHexRadius, hexDistance, shortestPath } from './hex.js';

const clone = value => structuredClone(value);
const uid = prefix => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

export class RuleError extends Error {
  constructor(message, code = 'RULE_ERROR') {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}

export class AoEGame {
  constructor(state) { this.state = state; }

  static create({ players, radius = 2, seedMap = true } = {}) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
      throw new RuleError('La partida requiere entre 2 y 4 jugadores.');
    }

    const hexes = generateHexRadius(radius);
    if (seedMap) AoEGame.seedDemoMap(hexes);

    const state = {
      version: 1,
      turn: 1,
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
        militaryPower: p.militaryPower ?? 3,
        maxMilitaryBid: p.maxMilitaryBid ?? 7,
        technologies: [],
        eliminated: false,
        tcHexId: null
      })),
      units: [],
      buildings: [],
      log: []
    };

    const game = new AoEGame(state);
    game.setupPlayers();
    game.log('game-start', { players: state.players.map(p => p.id) });
    return game;
  }

  static seedDemoMap(hexes) {
    const sources = ['forest', 'animals', 'stone', 'gold', 'berries', 'forest', 'animals', 'gold', 'stone'];
    hexes.forEach((hex, i) => {
      if (i % 7 === 0) hex.terrain = 'forest';
      if (i % 11 === 0) hex.terrain = 'mountain';
      if (i % 13 === 0) hex.terrain = 'desert';
      if (i > 1 && i % 9 === 0) hex.terrain = 'water';
      hex.source = hex.terrain === 'water' ? null : (sources[i % sources.length] || null);
    });
  }

  setupPlayers() {
    const land = this.state.hexes.filter(h => h.terrain !== 'water');
    const starts = [land[0], land[land.length - 1], land[Math.floor(land.length / 3)], land[Math.floor(land.length * 2 / 3)]];

    this.state.players.forEach((player, i) => {
      const hex = starts[i];
      player.tcHexId = hex.id;
      hex.controller = player.id;
      this.addBuilding(player.id, 'tc', hex.id);
      this.addUnit(player.id, 'villager', hex.id);
      this.addResourceTokens(player.id, hex.id, { food: 2, wood: 2, stone: 1, gold: 1 });
    });
  }

  get activePlayer() { return this.state.players[this.state.activePlayerIndex]; }
  get hexMap() { return new Map(this.state.hexes.map(h => [h.id, h])); }
  get playerMap() { return new Map(this.state.players.map(p => [p.id, p])); }

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
      turn: this.state.turn,
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
    const phaseIndex = PHASES.indexOf(this.state.phase);
    if (phaseIndex < PHASES.length - 1) {
      this.state.phase = PHASES[phaseIndex + 1];
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
    do { next = (next + 1) % this.state.players.length; }
    while (this.state.players[next].eliminated);

    if (next <= this.state.activePlayerIndex) this.state.turn += 1;
    this.state.activePlayerIndex = next;
    this.log('turn-start', { playerId: this.activePlayer.id });
  }

  addUnit(ownerId, type, hexId) {
    if (!UNIT_TYPES[type]) throw new RuleError(`Unidad desconocida: ${type}`);
    const unit = { id: uid('U'), ownerId, type, hexId, cargo: [], exhausted: false };
    this.state.units.push(unit);
    return unit;
  }

  addBuilding(ownerId, type, hexId) {
    if (!BUILDING_TYPES[type]) throw new RuleError(`Edificio desconocido: ${type}`);
    const building = { id: uid('B'), ownerId, type, hexId };
    this.state.buildings.push(building);
    return building;
  }

  addResourceTokens(ownerId, hexId, resources) {
    const hex = this.hexMap.get(hexId);
    if (!hex) throw new RuleError('Hexágono inexistente.');
    for (const type of RESOURCE_TYPES) {
      const amount = Math.max(0, Number(resources[type] || 0));
      for (let i = 0; i < amount; i++) hex.looseResources.push({ id: uid('R'), ownerId, type });
    }
  }

  resourcesAt(ownerId, hexId) {
    const hex = this.hexMap.get(hexId);
    const counts = Object.fromEntries(RESOURCE_TYPES.map(r => [r, 0]));
    for (const token of hex?.looseResources || []) if (token.ownerId === ownerId) counts[token.type]++;
    return counts;
  }

  canAffordAt(ownerId, hexId, cost = {}) {
    const have = this.resourcesAt(ownerId, hexId);
    return RESOURCE_TYPES.every(r => have[r] >= (cost[r] || 0));
  }

  spendAt(ownerId, hexId, cost = {}) {
    if (!this.canAffordAt(ownerId, hexId, cost)) {
      throw new RuleError('No hay suficientes recursos en ese hexágono.', 'INSUFFICIENT_RESOURCES');
    }

    const hex = this.hexMap.get(hexId);
    for (const type of RESOURCE_TYPES) {
      let remaining = cost[type] || 0;
      if (!remaining) continue;
      hex.looseResources = hex.looseResources.filter(token => {
        if (remaining > 0 && token.ownerId === ownerId && token.type === type) {
          remaining--;
          return false;
        }
        return true;
      });
    }
  }

  produce(playerId, hexIds) {
    this.assertActive(playerId);
    this.assertPhase('economy');
    const player = this.playerMap.get(playerId);
    const unique = [...new Set(hexIds || [])];
    const limit = AGE_PRODUCTION_LIMIT[player.age];
    if (!unique.length || unique.length > limit) throw new RuleError(`Podés producir en entre 1 y ${limit} hexágonos.`);

    const results = [];
    for (const hexId of unique) {
      const hex = this.hexMap.get(hexId);
      if (!hex) throw new RuleError(`Hexágono inexistente: ${hexId}`);
      const villagers = this.state.units.filter(u => u.ownerId === playerId && u.hexId === hexId && u.type === 'villager');
      const farm = this.state.buildings.find(b => b.ownerId === playerId && b.hexId === hexId && b.type === 'farm');
      const source = farm ? 'farm' : hex.source;
      const resourceType = SOURCE_TO_RESOURCE[source];
      if (!resourceType) throw new RuleError(`El hexágono ${hexId} no tiene una fuente productiva.`);
      if (!farm && villagers.length === 0) throw new RuleError(`Falta un Aldeano productor en ${hexId}.`);

      this.addResourceTokens(playerId, hexId, { [resourceType]: 1 });
      results.push({ hexId, resourceType, amount: 1 });
    }

    this.completeAction('produce', { results });
    return results;
  }

  moveUnits(playerId, unitIds, toHexId) {
    this.assertActive(playerId);
    if (!['economy', 'military'].includes(this.state.phase)) throw new RuleError('Mover sólo está disponible en Economía o Militar.');
    if (this.state.actionUsed) throw new RuleError('La acción de esta fase ya fue utilizada.');

    const target = this.hexMap.get(toHexId);
    if (!target) throw new RuleError('Hexágono de destino inexistente.');
    if (!unitIds?.length) throw new RuleError('Seleccioná al menos una unidad.');

    const units = unitIds.map(id => this.state.units.find(u => u.id === id));
    if (units.some(u => !u || u.ownerId !== playerId)) throw new RuleError('Hay una unidad inválida o enemiga.');
    if (this.state.phase === 'economy' && units.some(u => UNIT_TYPES[u.type].category !== 'economic')) {
      throw new RuleError('La acción Mover de Economía sólo mueve unidades económicas.');
    }
    if (this.state.units.some(u => u.hexId === toHexId && u.ownerId !== playerId)) {
      throw new RuleError('El destino contiene unidades enemigas: usá atacar().', 'ENEMY_OCCUPIED');
    }

    for (const unit of units) {
      const spec = UNIT_TYPES[unit.type];
      const path = shortestPath(
        this.state.hexes,
        unit.hexId,
        toHexId,
        h => spec.water ? h.terrain === 'water' : h.terrain !== 'water'
      );
      if (!path) throw new RuleError(`No existe camino válido para ${spec.name}.`);
      if (path.length - 1 > spec.move) throw new RuleError(`${spec.name} sólo puede mover ${spec.move}.`);
    }

    units.forEach(u => { u.hexId = toHexId; });
    target.controller = playerId;
    this.completeAction('move', { unitIds, toHexId });
  }

  loadResource(playerId, unitId, resourceType, amount = 1) {
    this.assertActive(playerId);
    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    if (!unit) throw new RuleError('Unidad inválida.');
    const spec = UNIT_TYPES[unit.type];
    if (!spec.carry) throw new RuleError('Esa unidad no transporta recursos.');
    if (unit.cargo.length + amount > spec.carry) throw new RuleError('Supera la capacidad de carga.');

    const hex = this.hexMap.get(unit.hexId);
    const available = hex.looseResources.filter(r => r.ownerId === playerId && r.type === resourceType);
    if (available.length < amount) throw new RuleError('No hay suficientes recursos para cargar.');

    const ids = new Set(available.slice(0, amount).map(r => r.id));
    const moved = [];
    hex.looseResources = hex.looseResources.filter(r => {
      if (ids.has(r.id)) {
        moved.push(r);
        return false;
      }
      return true;
    });
    unit.cargo.push(...moved);
  }

  unloadAll(playerId, unitId) {
    this.assertActive(playerId);
    const unit = this.state.units.find(u => u.id === unitId && u.ownerId === playerId);
    if (!unit) throw new RuleError('Unidad inválida.');
    const hex = this.hexMap.get(unit.hexId);
    hex.looseResources.push(...unit.cargo);
    unit.cargo = [];
  }

  build(playerId, buildingType, hexId, villagerId) {
    this.assertActive(playerId);
    const spec = BUILDING_TYPES[buildingType];
    if (!spec) throw new RuleError('Edificio desconocido.');
    this.assertPhase(spec.category === 'military' ? 'military' : 'economy');

    const hex = this.hexMap.get(hexId);
    const villager = this.state.units.find(
      u => u.id === villagerId && u.ownerId === playerId && u.type === 'villager' && u.hexId === hexId
    );

    if (!hex || !villager) throw new RuleError('Se requiere un Aldeano propio en el hexágono.');
    if (hex.terrain === 'water') throw new RuleError('No se puede construir directamente sobre Agua.');
    if (this.state.buildings.some(b => b.hexId === hexId && b.type === buildingType)) {
      throw new RuleError('Ese edificio ya existe en el hexágono.');
    }
    if (buildingType === 'farm' && hex.terrain !== 'plain') throw new RuleError('La Granja base requiere Llanura.');

    this.spendAt(playerId, hexId, spec.cost);
    const building = this.addBuilding(playerId, buildingType, hexId);
    hex.controller = playerId;
    this.completeAction('build', { buildingId: building.id, buildingType, hexId });
    return building;
  }

  train(playerId, unitType, buildingId) {
    this.assertActive(playerId);
    const spec = UNIT_TYPES[unitType];
    if (!spec) throw new RuleError('Unidad desconocida.');
    this.assertPhase(spec.category === 'military' ? 'military' : 'economy');

    const player = this.playerMap.get(playerId);
    if (AGES.indexOf(player.age) < AGES.indexOf(spec.age)) throw new RuleError('La Edad actual no permite entrenar esa unidad.');

    const building = this.state.buildings.find(b => b.id === buildingId && b.ownerId === playerId);
    if (!building || building.type !== spec.building) {
      throw new RuleError(`Se requiere ${BUILDING_TYPES[spec.building]?.name || spec.building}.`);
    }

    this.spendAt(playerId, building.hexId, spec.cost);
    const unit = this.addUnit(playerId, unitType, building.hexId);
    this.completeAction('train', { unitId: unit.id, unitType, buildingId });
    return unit;
  }

  advanceAge(playerId) {
    this.assertActive(playerId);
    this.assertPhase('technology');
    const player = this.playerMap.get(playerId);
    const current = AGES.indexOf(player.age);
    if (current >= AGES.length - 1) throw new RuleError('Ya está en Edad Imperial.');

    const nextAge = AGES[current + 1];
    this.spendAt(playerId, player.tcHexId, AGE_COSTS[nextAge]);
    player.age = nextAge;
    this.completeAction('advance-age', { age: nextAge });
  }

  instruct(playerId) {
    this.assertActive(playerId);
    this.assertPhase('military');
    const player = this.playerMap.get(playerId);
    this.spendAt(playerId, player.tcHexId, { gold: 1 });
    player.militaryPower += 1;
    this.completeAction('instruct', { militaryPower: player.militaryPower });
  }

  forceFor(playerId, targetHexId, directUnitIds = null) {
    let force = 0;
    const target = this.hexMap.get(targetHexId);
    if (!target) return 0;

    for (const unit of this.state.units) {
      if (unit.ownerId !== playerId) continue;
      const spec = UNIT_TYPES[unit.type];
      if (directUnitIds && directUnitIds.includes(unit.id)) force += spec.force;
      else if (!directUnitIds && unit.hexId === targetHexId) force += spec.force;
      else if (spec.range > 0) {
        const source = this.hexMap.get(unit.hexId);
        if (source && hexDistance(source, target) <= spec.range) force += spec.force;
      }
    }
    return force;
  }

  attack(playerId, { unitIds, targetHexId, attackerBid = 0, defenderBid = 0 } = {}) {
    this.assertActive(playerId);
    this.assertPhase('military');

    const attacker = this.playerMap.get(playerId);
    const target = this.hexMap.get(targetHexId);
    if (!target) throw new RuleError('Hexágono objetivo inexistente.');

    const directUnits = (unitIds || []).map(id => this.state.units.find(u => u.id === id));
    if (!directUnits.length || directUnits.some(
      u => !u || u.ownerId !== playerId || UNIT_TYPES[u.type].category !== 'military'
    )) throw new RuleError('El ataque requiere unidades militares propias.');

    const defenderUnit = this.state.units.find(u => u.hexId === targetHexId && u.ownerId !== playerId);
    const defenderBuilding = this.state.buildings.find(b => b.hexId === targetHexId && b.ownerId !== playerId);
    const defenderId = defenderUnit?.ownerId || defenderBuilding?.ownerId;
    if (!defenderId) throw new RuleError('No hay objetivo enemigo en ese hexágono.');

    const defender = this.playerMap.get(defenderId);
    for (const unit of directUnits) {
      const spec = UNIT_TYPES[unit.type];
      const from = this.hexMap.get(unit.hexId);
      if (!from || hexDistance(from, target) > spec.move) throw new RuleError(`${spec.name} no llega al objetivo.`);
    }

    if (attackerBid < 0 || attackerBid > Math.min(attacker.maxMilitaryBid, attacker.militaryPower)) {
      throw new RuleError('Apuesta atacante inválida.');
    }
    if (defenderBid < 0 || defenderBid > Math.min(defender.maxMilitaryBid, defender.militaryPower)) {
      throw new RuleError('Apuesta defensora inválida.');
    }

    const attackerForce = this.forceFor(playerId, targetHexId, directUnits.map(u => u.id));
    const defenderForce = this.forceFor(defenderId, targetHexId, null);
    const attackerTotal = attackerForce + attackerBid;
    const defenderTotal = defenderForce + defenderBid;
    const attackerWins = attackerTotal > defenderTotal;

    attacker.militaryPower -= attackerBid;
    defender.militaryPower -= defenderBid;

    if (attackerWins) {
      directUnits.forEach(u => { u.hexId = targetHexId; });
      this.returnUnitsToTC(defenderId, targetHexId);
      this.state.buildings = this.state.buildings.filter(
        b => !(b.ownerId === defenderId && b.hexId === targetHexId)
      );
      target.controller = playerId;

      if (!this.state.buildings.some(b => b.ownerId === defenderId && b.type === 'tc')) {
        this.eliminatePlayer(defenderId);
      }
    } else {
      const losingIds = new Set(directUnits.map(u => u.id));
      this.state.units.forEach(u => {
        if (losingIds.has(u.id)) u.hexId = attacker.tcHexId;
      });
    }

    const result = {
      attackerId: playerId,
      defenderId,
      targetHexId,
      attackerForce,
      defenderForce,
      attackerBid,
      defenderBid,
      attackerTotal,
      defenderTotal,
      winnerId: attackerWins ? playerId : defenderId
    };

    this.completeAction('combat', result);
    return result;
  }

  returnUnitsToTC(playerId, hexId) {
    const player = this.playerMap.get(playerId);
    for (const unit of this.state.units) {
      if (unit.ownerId === playerId && unit.hexId === hexId) unit.hexId = player.tcHexId;
    }
  }

  eliminatePlayer(playerId) {
    const player = this.playerMap.get(playerId);
    if (!player) return;
    player.eliminated = true;
    this.log('player-eliminated', { playerId });
  }

  snapshot() { return clone(this.state); }
}
