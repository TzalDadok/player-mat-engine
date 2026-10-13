export const BOT_PROFILES = {
  balanced: {
    name: 'Equilibrado',
    aggression: 0.2,
    maxVillagers: 4,
    desiredArmy: 5,
    maxArmy: 8,
    villagerCadence: 3,
    ageArmyThreshold: 2,
    researchArmyThreshold: 1,
    researchFirst: false
  },
  aggressive: {
    name: 'Agresivo',
    aggression: 0.75,
    maxVillagers: 3,
    desiredArmy: 6,
    maxArmy: 9,
    villagerCadence: 4,
    ageArmyThreshold: 4,
    researchArmyThreshold: 3,
    researchFirst: false
  },
  economic: {
    name: 'Económico',
    aggression: 0.1,
    maxVillagers: 5,
    desiredArmy: 4,
    maxArmy: 8,
    villagerCadence: 2,
    ageArmyThreshold: 3,
    researchArmyThreshold: 2,
    researchFirst: false
  },
  technological: {
    name: 'Tecnológico',
    aggression: 0.15,
    maxVillagers: 4,
    desiredArmy: 4,
    maxArmy: 7,
    villagerCadence: 3,
    ageArmyThreshold: 2,
    researchArmyThreshold: 1,
    researchFirst: true
  }
};

export function getBotProfile(id='balanced') {
  const profile=BOT_PROFILES[id];
  if(!profile) throw new Error(`Perfil de bot desconocido: ${id}`);
  return { id, ...profile };
}
