export const axialKey = (q, r) => `${q},${r}`;

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (-a.q - a.r) - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

export function areAdjacent(a, b) { return hexDistance(a, b) === 1; }

export function generateHexRadius(radius = 2) {
  const hexes = [];
  let n = 1;
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({
        id: `H${n++}`, q, r, terrain: 'plain', source: null, looseResources: [],
        special: null, tcOwnerId: null, waterLane: null, palisades: [], productionHistory: {}
      });
    }
  }
  return hexes;
}

export function physicalNeighbors(hexes, hexId) {
  const current = hexes.find(h => h.id === hexId);
  return current ? hexes.filter(h => areAdjacent(current, h)) : [];
}

export function movementNeighbors(hexes, hexId, { water = false } = {}) {
  const current = hexes.find(h => h.id === hexId);
  if (!current) return [];
  if (water && current.terrain === 'water') {
    return hexes.filter(h => h.id !== current.id && h.terrain === 'water' && h.waterLane && h.waterLane !== current.waterLane);
  }
  return physicalNeighbors(hexes, hexId);
}

export function shortestMovementPath(hexes, fromId, toId, { water = false, blockedEdge = () => false } = {}) {
  if (fromId === toId) return [fromId];
  const byId = new Map(hexes.map(h => [h.id, h]));
  const start = byId.get(fromId), goal = byId.get(toId);
  if (!start || !goal) return null;

  const queue = [fromId];
  const prev = new Map([[fromId, null]]);
  while (queue.length) {
    const currentId = queue.shift();
    const current = byId.get(currentId);
    const neighbors = movementNeighbors(hexes, currentId, { water });
    for (const candidate of neighbors) {
      if (prev.has(candidate.id) || blockedEdge(currentId, candidate.id)) continue;
      if (water ? candidate.terrain !== 'water' : candidate.terrain === 'water') continue;
      prev.set(candidate.id, currentId);
      if (candidate.id === toId) {
        const path = [];
        let cursor = toId;
        while (cursor) { path.push(cursor); cursor = prev.get(cursor); }
        return path.reverse();
      }
      if (candidate.terrain !== 'mountain') queue.push(candidate.id);
    }
  }
  return null;
}
