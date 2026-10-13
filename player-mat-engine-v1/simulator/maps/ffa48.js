// Compatibilidad histórica. El FFA vigente usa 36 terrenos en tres gradas.
export {
  generateFFA36Map,
  generateFFA36Map as generateFFA48Map,
  createFFAPlayerPiles,
  placementCategoryFor,
  placeFFAPlayerCU,
  scoreFFAStartAnchor,
  chooseFFAStartAnchor,
  autoPlaceFFAPlayerCUs
} from './ffa36.js';
