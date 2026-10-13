export const axialKey = (q, r) => `${q},${r}`;

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (-a.q - a.r) - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

export function areAdjacent(a, b) {
  return hexDistance(a, b) === 1;
}

export function generateHexRadius(radius = 2) {
  const hexes = [];
  let n = 1;
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({
        id: `H${n++}`,
        q,
        r,
        terrain: 'plain',
        source: null,
        looseResources: [],
        controller: null
      });
    }
  }
  return hexes;
}

export function shortestPath(hexes, fromId, toId, passable = () => true) {
  if (fromId === toId) return [fromId];
  const byId = new Map(hexes.map(h => [h.id, h]));
  const start = byId.get(fromId);
  const goal = byId.get(toId);
  if (!start || !goal) return null;

  const queue = [fromId];
  const prev = new Map([[fromId, null]]);

  while (queue.length) {
    const currentId = queue.shift();
    const current = byId.get(currentId);
    for (const candidate of hexes) {
      if (prev.has(candidate.id) || !areAdjacent(current, candidate) || !passable(candidate)) continue;
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
