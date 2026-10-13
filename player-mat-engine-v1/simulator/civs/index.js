import { britones } from './britones.js';
import { francos } from './francos.js';
import { vikingos } from './vikingos.js';
import { persas } from './persas.js';

export const CIVILIZATIONS = {
  britanicos: britones,
  britones,
  francos,
  vikingos,
  persas
};

export function getCivilization(id) {
  return CIVILIZATIONS[id] || null;
}
