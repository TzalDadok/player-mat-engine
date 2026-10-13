export const tech = (id, name, age, building, cost, text, effects = []) => ({
  id, name, age, building, cost, text, effects
});

export const entry = (age, building, cost, extra = {}) => ({
  age, building, cost, ...extra
});
